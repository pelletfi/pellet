import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { TEMPO_ADDRESSES } from "@/lib/types";
import { enqueueWebhookEvent } from "./webhook-deliver";

// The deployed TIP-403 registry at 0x403c… doesn't implement the canonical
// read functions (policyData / getPolicy — both revert with "unknown function
// selector"), so we reconstruct the (policy_id → admin, policy_type) map
// off-chain by replaying the state-change events in block order.
//
// Topic hashes verified against events already indexed in the `events` table
// — 55 of each at the time of writing.  Stored as raw hex so no keccak-at-
// runtime is needed.
const POLICY_CREATED_TOPIC =
  "0x718d87917f0c4cfd1263707ef0e77c656ed8d8bfaca06152bdb0b8094142ec27";
const POLICY_ADMIN_UPDATED_TOPIC =
  "0x98925cfb1bc09c5b43dd0dd56d3d95aa04fb3300927580cc588c3f5dd58c15e1";

// TIP-403 PolicyType enum.  Matches the on-chain emission: 0 = whitelist,
// 1 = blacklist, 2 = compound (allow + block together).
const POLICY_TYPE_LABELS: Record<number, string> = {
  0: "whitelist",
  1: "blacklist",
  2: "compound",
};

interface EventRow {
  event_type: string;
  block_number: string | number;
  log_index: number;
  args: { topics: string[]; data: string };
}

/** Turn a 32-byte indexed-topic hex string into a lower-case `0x`-prefixed
 * 20-byte address. */
function topicToAddress(topic: string): string {
  return `0x${topic.slice(-40).toLowerCase()}`;
}

/** Parse a uint from a hex-encoded topic.  Policy IDs fit comfortably in a
 * JS Number (uint64 max = 2^64-1, policies on Tempo are sequentially assigned
 * so the counter will not exceed 2^53 in any realistic timeframe). */
function topicToNumber(topic: string): number {
  return Number(BigInt(topic));
}

/** Parse the uint8 PolicyType from the 32-byte data payload of PolicyCreated. */
function parsePolicyType(data: string): string {
  if (!data || data === "0x") return "unknown";
  const byte = Number(BigInt(data));
  return POLICY_TYPE_LABELS[byte] ?? "unknown";
}

export interface BuildResult {
  eventsProcessed: number;
  policiesCreatedSeen: number;
  adminUpdatesSeen: number;
  policiesWritten: number;
  /** Number of diff-driven webhook events enqueued on this run. */
  webhooksEnqueued: number;
  /** Most-recent block seen in either event stream — signals crawl freshness. */
  latestBlock: number | null;
}

/** Rebuild the `policies` table from the indexed TIP-403 state-change events.
 *
 * We replay every PolicyCreated and PolicyAdminUpdated log in block order,
 * accumulating the current `(policyType, admin)` for each policyId, then
 * UPSERT the resulting rows.  Running this every few minutes is cheap —
 * ~110 events at time of writing — and correctly handles admin transfers
 * since the last PolicyAdminUpdated event wins.
 *
 * Note: tokens[] / tokenCount are NOT populated here because the mapping
 * from a TIP-20 contract to its policy_id is not emitted by the registry
 * itself; that would require a TIP-20-side event indexer.  Leaving those
 * columns null is the honest OLI answer until the follow-up ships. */
export async function rebuildPolicyIndex(): Promise<BuildResult> {
  const registry = TEMPO_ADDRESSES.tip403Registry.toLowerCase();

  const result = await db.execute(sql`
    SELECT event_type, block_number, log_index, args
    FROM events
    WHERE contract = ${registry}
      AND event_type IN (${POLICY_CREATED_TOPIC}, ${POLICY_ADMIN_UPDATED_TOPIC})
    ORDER BY block_number ASC, log_index ASC
  `);
  const rows = ((result as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (result as unknown as Record<string, unknown>[])) as unknown as EventRow[];

  const state = new Map<number, { type: string | null; admin: string | null }>();
  let created = 0;
  let adminUpdated = 0;
  let latestBlock = 0;

  for (const row of rows) {
    const topics = row.args.topics;
    const data = row.args.data;
    if (!topics || topics.length < 2) continue;
    const policyId = topicToNumber(topics[1]);
    const bn = Number(row.block_number);
    if (bn > latestBlock) latestBlock = bn;

    if (row.event_type === POLICY_CREATED_TOPIC) {
      // PolicyCreated(uint256 indexed policyId, address indexed admin, uint8 policyType)
      if (topics.length < 3) continue;
      const admin = topicToAddress(topics[2]);
      const type = parsePolicyType(data);
      state.set(policyId, { type, admin });
      created += 1;
    } else if (row.event_type === POLICY_ADMIN_UPDATED_TOPIC) {
      // PolicyAdminUpdated(uint256 indexed policyId, address indexed updater, address indexed newAdmin)
      if (topics.length < 4) continue;
      const newAdmin = topicToAddress(topics[3]);
      const existing = state.get(policyId);
      if (existing) {
        existing.admin = newAdmin;
      } else {
        // Edge case: an admin update was indexed before its creator event
        // (shouldn't happen with chronological ordering, but the `type: null`
        // here keeps the derivation honest if it ever does).
        state.set(policyId, { type: null, admin: newAdmin });
      }
      adminUpdated += 1;
    }
  }

  // UPSERT the reconstructed state back into `policies`.  We compare against
  // the previous row so we can emit webhook events only on genuine changes —
  // every cron tick writes every policy, but subscribers only want notifying
  // when something actually moved.
  let written = 0;
  let webhooksEnqueued = 0;
  for (const [policyId, { type, admin }] of state) {
    const priorResult = await db.execute(sql`
      SELECT policy_type, admin FROM policies WHERE policy_id = ${policyId}
    `);
    const priorRows = ((priorResult as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (priorResult as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
    const prior = priorRows[0] ?? null;

    await db.execute(sql`
      INSERT INTO policies (policy_id, policy_type, admin, updated_at)
      VALUES (${policyId}, ${type}, ${admin}, NOW())
      ON CONFLICT (policy_id) DO UPDATE SET
        policy_type = COALESCE(EXCLUDED.policy_type, policies.policy_type),
        admin = EXCLUDED.admin,
        updated_at = NOW()
    `);
    written += 1;

    // Diff-driven webhooks — new policy = policy_created; admin changed on
    // an existing policy = policy_admin_changed.  Delivery is best-effort;
    // failures are logged but don't abort the cron.
    try {
      if (!prior) {
        await enqueueWebhookEvent(
          "tip403.policy_created",
          { policy_id: policyId, policy_type: type, admin },
          null,
        );
        webhooksEnqueued += 1;
      } else if (prior.admin !== admin && admin !== null) {
        await enqueueWebhookEvent(
          "tip403.policy_admin_changed",
          {
            policy_id: policyId,
            policy_type: type,
            previous_admin: prior.admin,
            new_admin: admin,
          },
          null,
        );
        webhooksEnqueued += 1;
      }
    } catch (err) {
      console.error(
        `[tip403-admin-index] webhook enqueue failed for policy ${policyId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return {
    eventsProcessed: rows.length,
    policiesCreatedSeen: created,
    adminUpdatesSeen: adminUpdated,
    policiesWritten: written,
    webhooksEnqueued,
    latestBlock: latestBlock || null,
  };
}
