import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { tempoClient } from "@/lib/rpc";
import { KNOWN_STABLECOINS } from "@/lib/pipeline/stablecoins";

// Tempo TIP-20 doesn't expose role enumeration AND doesn't emit role events.
// But role HOLDERS leave fingerprints: any address whose internal call to a
// TIP-20 contract triggered a mint/burn/burnBlocked MUST hold the corresponding
// role at that moment. We use debug_traceTransaction to walk the call tree of
// each role-bearing tx, find every internal call to the stable, and verify
// the caller via tempoClient.token.hasRole().

const TOPICS = {
  Mint: "0x0f6798a560793a54c3bcfe86a93cde1e73087d944c0ea20544137d4121396885",
  Burn: "0xcc16f5dbb4873280815c1ee09dbd06736cffcc184412cf7a71a0fdb75d397ca5",
  BurnBlocked: "0xbbf8c20751167a65b38d4dd87c3eba00bfae01d85fb809a89eee1ba842673b98",
};

interface EventRow {
  tx_hash: string;
  block_number: number;
  block_timestamp: string;
  event_type: string;
}

interface CallTrace {
  from?: string;
  to?: string;
  calls?: CallTrace[];
}

// Recursively find every internal call within `trace` whose `to` matches `target`.
// Returns the unique set of `from` addresses (the immediate callers — msg.sender
// from the target's perspective).
function findDirectCallers(trace: CallTrace, target: string, into: Set<string> = new Set()): Set<string> {
  if (trace.to?.toLowerCase() === target && trace.from) {
    into.add(trace.from.toLowerCase());
  }
  for (const child of trace.calls ?? []) {
    findDirectCallers(child, target, into);
  }
  return into;
}

async function traceCallers(txHash: string, target: string): Promise<Set<string>> {
  try {
    const trace = (await tempoClient.request({
      method: "debug_traceTransaction" as never,
      params: [txHash, { tracer: "callTracer" }] as never,
    })) as CallTrace;
    return findDirectCallers(trace, target);
  } catch {
    return new Set();
  }
}

type TempoRole = "defaultAdmin" | "issuer" | "pause" | "unpause" | "burnBlocked";

const ROLE_NAMES: Record<TempoRole, string> = {
  defaultAdmin: "DEFAULT_ADMIN_ROLE",
  issuer: "ISSUER_ROLE",
  pause: "PAUSE_ROLE",
  unpause: "UNPAUSE_ROLE",
  burnBlocked: "BURN_BLOCKED_ROLE",
};

async function probeAllRoles(stable: string, account: string): Promise<TempoRole[]> {
  const held: TempoRole[] = [];
  const roles: TempoRole[] = ["defaultAdmin", "issuer", "pause", "unpause", "burnBlocked"];
  for (const role of roles) {
    try {
      const r = await tempoClient.token.hasRole({
        token: stable as `0x${string}`,
        account: account as `0x${string}`,
        role,
      });
      if (r) held.push(role);
    } catch {
      // role not implemented for this contract, skip
    }
  }
  return held;
}

export interface BuildResult {
  stablesProcessed: number;
  txsTraced: number;
  callersFound: number;
  roleVerifications: number;
  confirmedHolders: number;
}

export async function rebuildRoleHolders(): Promise<BuildResult> {
  let txsTraced = 0;
  let callersFound = 0;
  let roleVerifications = 0;
  let confirmedHolders = 0;

  // Cache trace results across stables (a single tx can hit multiple stables in theory)
  const traceCache = new Map<string, Set<string>>();

  for (const stable of KNOWN_STABLECOINS) {
    const stableAddr = stable.address.toLowerCase();

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

    // Collect (caller → earliest tx) for this stable
    const earliestByAddr = new Map<string, { tx: string; ts: string }>();

    // Dedupe by tx hash so we only trace each tx once per stable
    const uniqueTxs = new Map<string, EventRow>();
    for (const ev of events) {
      const existing = uniqueTxs.get(ev.tx_hash);
      if (!existing || ev.block_timestamp < existing.block_timestamp) {
        uniqueTxs.set(ev.tx_hash, ev);
      }
    }

    for (const [txHash, ev] of uniqueTxs) {
      const cacheKey = `${txHash}:${stableAddr}`;
      let callers = traceCache.get(cacheKey);
      if (!callers) {
        callers = await traceCallers(txHash, stableAddr);
        traceCache.set(cacheKey, callers);
        txsTraced += 1;
      }
      callersFound += callers.size;
      for (const c of callers) {
        const existing = earliestByAddr.get(c);
        if (!existing || ev.block_timestamp < existing.ts) {
          earliestByAddr.set(c, { tx: txHash, ts: ev.block_timestamp });
        }
      }
    }

    // Verify each caller against all 5 roles
    interface Confirmed {
      roleName: string;
      account: string;
      earliestTx: string;
      earliestTs: string;
    }
    const confirmed: Confirmed[] = [];

    for (const [account, seen] of earliestByAddr) {
      roleVerifications += 5;
      const roles = await probeAllRoles(stableAddr, account);
      for (const role of roles) {
        confirmed.push({
          roleName: ROLE_NAMES[role],
          account,
          earliestTx: seen.tx,
          earliestTs: seen.ts,
        });
      }
    }

    await db.execute(sql`DELETE FROM role_holders WHERE stable = ${stableAddr}`);
    for (const h of confirmed) {
      await db.execute(sql`
        INSERT INTO role_holders (
          stable, role_hash, role_name, holder, granted_at, granted_tx_hash, label
        ) VALUES (
          ${stableAddr}, '', ${h.roleName}, ${h.account},
          ${h.earliestTs}, ${h.earliestTx},
          ${"derived from on-chain trace + hasRole verification"}
        )
        ON CONFLICT (stable, role_hash, holder) DO NOTHING
      `);
      confirmedHolders += 1;
    }
  }

  return {
    stablesProcessed: KNOWN_STABLECOINS.length,
    txsTraced,
    callersFound,
    roleVerifications,
    confirmedHolders,
  };
}
