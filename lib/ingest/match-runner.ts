import { db } from "@/lib/db/client";
import { agents, agentEvents } from "@/lib/db/schema";
import { matchEvent, type AgentLite, type RawEventRow } from "./matcher";
import { sql } from "drizzle-orm";

// Pulls events that haven't yet been matched (no agent_events row referencing
// them), runs the matcher, and inserts agent_events rows. Idempotent — safe
// to re-run; the NOT EXISTS subquery + the agent_events PK + the (tx_hash,
// log_index, agent_id) uniqueness pattern ensure no duplicates.
//
// Decoupling raw event ingestion from agent matching means we can re-run the
// matcher with a new methodology version without re-fetching chain data.
export async function runMatcher(limit = 1000): Promise<{
  scanned: number;
  matched: number;
  agents: number;
}> {
  const activeAgents = await db
    .select({ id: agents.id, label: agents.label, wallets: agents.wallets })
    .from(agents)
    .where(sql`${agents.active} = true`);

  if (activeAgents.length === 0) {
    return { scanned: 0, matched: 0, agents: 0 };
  }

  const lite: AgentLite[] = activeAgents.map((a) => ({
    id: a.id,
    label: a.label,
    wallets: a.wallets ?? [],
  }));

  // Pull unmatched events (no agent_events row referencing them).
  const result = await db.execute<RawEventRow & { ts_iso: string }>(sql`
    SELECT
      e.tx_hash         AS "txHash",
      e.log_index       AS "logIndex",
      e.block_number    AS "blockNumber",
      e.block_timestamp AS "blockTimestamp",
      e.contract,
      e.event_type      AS "eventType",
      e.args
    FROM events e
    WHERE NOT EXISTS (
      SELECT 1 FROM agent_events ae
      WHERE ae.tx_hash = e.tx_hash AND ae.log_index = e.log_index
    )
    ORDER BY e.block_timestamp DESC
    LIMIT ${limit}
  `);

  const rows = result.rows as unknown as Array<RawEventRow>;
  let matched = 0;

  for (const row of rows) {
    // Postgres returns timestamp as a Date object via node-postgres; coerce
    // defensively in case it arrives as string.
    const ts = row.blockTimestamp instanceof Date
      ? row.blockTimestamp
      : new Date(row.blockTimestamp);
    const matches = matchEvent({ ...row, blockTimestamp: ts }, lite);
    if (matches.length === 0) continue;

    await db
      .insert(agentEvents)
      .values(
        matches.map((m) => ({
          agentId: m.agentId,
          txHash: m.txHash,
          logIndex: m.logIndex,
          ts: m.ts,
          kind: m.kind,
          summary: m.summary,
          targets: m.targets,
          sourceBlock: m.sourceBlock,
          methodologyVersion: m.methodologyVersion,
        })),
      )
      .onConflictDoNothing();
    matched += matches.length;
  }

  return { scanned: rows.length, matched, agents: lite.length };
}
