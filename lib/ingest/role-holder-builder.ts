import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { keccak256, toBytes } from "viem";
import { tempoClient } from "@/lib/rpc";
import { KNOWN_STABLECOINS } from "@/lib/pipeline/stablecoins";

// Tempo TIP-20 doesn't expose role enumeration AND doesn't emit role events.
// But role HOLDERS leave fingerprints: any address that successfully called
// mint/burn/burnBlocked on a TIP-20 contract MUST hold the corresponding role
// at the time of the call. We can derive role holders by inspecting the
// `from` field of transactions that emitted those events, then verify each
// candidate is still active via hasRole().

const TOPICS = {
  // From event-type discovery in events table
  Mint: "0x0f6798a560793a54c3bcfe86a93cde1e73087d944c0ea20544137d4121396885",
  Burn: "0xcc16f5dbb4873280815c1ee09dbd06736cffcc184412cf7a71a0fdb75d397ca5",
  BurnBlocked: "0xbbf8c20751167a65b38d4dd87c3eba00bfae01d85fb809a89eee1ba842673b98",
};

const ROLE_HASHES = {
  ISSUER_ROLE: keccak256(toBytes("ISSUER_ROLE")),
  BURN_BLOCKED_ROLE: keccak256(toBytes("BURN_BLOCKED_ROLE")),
};

const HAS_ROLE_ABI = [
  {
    name: "hasRole",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

interface EventRow {
  tx_hash: string;
  block_number: number;
  block_timestamp: string;
  event_type: string;
}

interface RoleProbe {
  roleName: string;
  roleHash: `0x${string}`;
  candidateAddrs: Set<string>;
  earliestSeenAt: Map<string, { tx: string; ts: string }>;
}

export interface BuildResult {
  stablesProcessed: number;
  txsFetched: number;
  roleVerifications: number;
  confirmedHolders: number;
  unverifiedCandidates: number;
}

async function fetchTxFrom(txHash: string): Promise<string | null> {
  try {
    const tx = await tempoClient.getTransaction({ hash: txHash as `0x${string}` });
    return tx.from?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

async function probeHasRole(stable: string, role: `0x${string}`, account: string): Promise<boolean> {
  try {
    const res = await tempoClient.readContract({
      address: stable as `0x${string}`,
      abi: HAS_ROLE_ABI,
      functionName: "hasRole",
      args: [role, account as `0x${string}`],
    });
    return Boolean(res);
  } catch {
    return false;
  }
}

export async function rebuildRoleHolders(): Promise<BuildResult> {
  let txsFetched = 0;
  let roleVerifications = 0;
  let confirmedHolders = 0;
  let unverifiedCandidates = 0;

  // Cache tx → from across all stables (some txs span multiple events)
  const txFromCache = new Map<string, string | null>();

  for (const stable of KNOWN_STABLECOINS) {
    const stableAddr = stable.address.toLowerCase();

    // Build per-role candidate sets
    const probes: RoleProbe[] = [
      {
        roleName: "ISSUER_ROLE",
        roleHash: ROLE_HASHES.ISSUER_ROLE,
        candidateAddrs: new Set(),
        earliestSeenAt: new Map(),
      },
      {
        roleName: "BURN_BLOCKED_ROLE",
        roleHash: ROLE_HASHES.BURN_BLOCKED_ROLE,
        candidateAddrs: new Set(),
        earliestSeenAt: new Map(),
      },
    ];
    const issuerProbe = probes[0];
    const burnBlockedProbe = probes[1];

    // Pull mint+burn (issuer fingerprint) and burnBlocked events
    const evResult = await db.execute(sql`
      SELECT tx_hash, block_number, block_timestamp, event_type
      FROM events
      WHERE contract = ${stableAddr}
        AND event_type IN (${TOPICS.Mint}, ${TOPICS.Burn}, ${TOPICS.BurnBlocked})
      ORDER BY block_number ASC, log_index ASC
    `);
    const events = ((evResult as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (evResult as unknown as Record<string, unknown>[])) as unknown as EventRow[];

    if (events.length === 0) continue;

    // Fetch tx.from for each unique tx hash
    for (const ev of events) {
      let from = txFromCache.get(ev.tx_hash);
      if (from === undefined) {
        from = await fetchTxFrom(ev.tx_hash);
        txFromCache.set(ev.tx_hash, from);
        txsFetched += 1;
      }
      if (!from) continue;

      const target = ev.event_type === TOPICS.BurnBlocked ? burnBlockedProbe : issuerProbe;
      target.candidateAddrs.add(from);
      const existing = target.earliestSeenAt.get(from);
      if (!existing || ev.block_timestamp < existing.ts) {
        target.earliestSeenAt.set(from, { tx: ev.tx_hash, ts: ev.block_timestamp });
      }
    }

    // Verify each candidate with hasRole, then write confirmed holders
    interface Confirmed {
      roleName: string;
      roleHash: string;
      account: string;
      earliestTx: string;
      earliestTs: string;
    }
    const confirmed: Confirmed[] = [];

    for (const probe of probes) {
      for (const account of probe.candidateAddrs) {
        roleVerifications += 1;
        const has = await probeHasRole(stableAddr, probe.roleHash, account);
        if (has) {
          const seen = probe.earliestSeenAt.get(account);
          if (!seen) continue;
          confirmed.push({
            roleName: probe.roleName,
            roleHash: probe.roleHash.toLowerCase(),
            account,
            earliestTx: seen.tx,
            earliestTs: seen.ts,
          });
        } else {
          unverifiedCandidates += 1;
        }
      }
    }

    // Wipe + reinsert this stable's confirmed holders
    await db.execute(sql`DELETE FROM role_holders WHERE stable = ${stableAddr}`);
    for (const h of confirmed) {
      await db.execute(sql`
        INSERT INTO role_holders (
          stable, role_hash, role_name, holder, granted_at, granted_tx_hash, label
        ) VALUES (
          ${stableAddr}, ${h.roleHash}, ${h.roleName}, ${h.account},
          ${h.earliestTs}, ${h.earliestTx},
          ${"derived from on-chain action history"}
        )
        ON CONFLICT (stable, role_hash, holder) DO NOTHING
      `);
      confirmedHolders += 1;
    }
  }

  return {
    stablesProcessed: KNOWN_STABLECOINS.length,
    txsFetched,
    roleVerifications,
    confirmedHolders,
    unverifiedCandidates,
  };
}
