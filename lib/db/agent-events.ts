import { db } from "./client";
import { agentEvents, agents } from "./schema";
import { desc, eq } from "drizzle-orm";

export type FeedRow = {
  id: number;
  agentId: string;
  agentLabel: string;
  ts: Date;
  kind: string;
  summary: string;
  txHash: string;
  sourceBlock: number;
  methodologyVersion: string;
  isPellet: boolean;
};

export async function recentFeed(limit = 100): Promise<FeedRow[]> {
  const rows = await db
    .select({
      id: agentEvents.id,
      agentId: agentEvents.agentId,
      agentLabel: agents.label,
      ts: agentEvents.ts,
      kind: agentEvents.kind,
      summary: agentEvents.summary,
      txHash: agentEvents.txHash,
      sourceBlock: agentEvents.sourceBlock,
      methodologyVersion: agentEvents.methodologyVersion,
    })
    .from(agentEvents)
    .innerJoin(agents, eq(agents.id, agentEvents.agentId))
    .orderBy(desc(agentEvents.ts))
    .limit(limit);

  return rows.map((r) => ({ ...r, isPellet: r.agentId === "pellet" }));
}

export async function getFeedRowById(id: number): Promise<FeedRow | null> {
  const rows = await db
    .select({
      id: agentEvents.id,
      agentId: agentEvents.agentId,
      agentLabel: agents.label,
      ts: agentEvents.ts,
      kind: agentEvents.kind,
      summary: agentEvents.summary,
      txHash: agentEvents.txHash,
      sourceBlock: agentEvents.sourceBlock,
      methodologyVersion: agentEvents.methodologyVersion,
    })
    .from(agentEvents)
    .innerJoin(agents, eq(agents.id, agentEvents.agentId))
    .where(eq(agentEvents.id, id))
    .limit(1);
  if (rows.length === 0) return null;
  return { ...rows[0], isPellet: rows[0].agentId === "pellet" };
}
