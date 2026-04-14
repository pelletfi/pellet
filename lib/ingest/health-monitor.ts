import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { tempoClient } from "@/lib/rpc";
import { enqueueWebhookEvent } from "./webhook-deliver";

// Thresholds
const MAX_CURSOR_LAG_BLOCKS = 600; // ~10 min behind chain head triggers drift
const MAX_PEG_SAMPLE_LAG_SEC = 300; // 5 min without a sample is concerning

interface HealthDetail {
  cursor?: { last_block: number; chain_head: number; lag_blocks: number };
  peg_samples?: { latest_at: string | null; lag_seconds: number | null };
}

export interface HealthResult {
  overall: "ok" | "drift" | "fail";
  details: HealthDetail;
}

export async function runHealthCheck(): Promise<HealthResult> {
  const detail: HealthDetail = {};
  let overall: "ok" | "drift" | "fail" = "ok";

  // 1. Cursor lag
  try {
    const chainHead = Number(await tempoClient.getBlockNumber());
    const r = await db.execute(sql`
      SELECT last_block::int8 AS last_block FROM ingestion_cursors
      WHERE contract = '__global__' LIMIT 1
    `);
    const rows = ((r as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (r as unknown as Record<string, unknown>[])) as Array<{ last_block: number }>;
    const lastBlock = rows[0] ? Number(rows[0].last_block) : 0;
    const lag = chainHead - lastBlock;
    detail.cursor = { last_block: lastBlock, chain_head: chainHead, lag_blocks: lag };
    if (lag > MAX_CURSOR_LAG_BLOCKS) overall = "drift";
  } catch (e) {
    overall = "fail";
    detail.cursor = { last_block: 0, chain_head: 0, lag_blocks: -1 };
  }

  // 2. Peg sample freshness
  try {
    const r = await db.execute(sql`
      SELECT MAX(sampled_at) AS latest_at FROM peg_samples
    `);
    const rows = ((r as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (r as unknown as Record<string, unknown>[])) as Array<{ latest_at: string | null }>;
    const latestAt = rows[0]?.latest_at ?? null;
    const lagSec = latestAt
      ? Math.floor((Date.now() - new Date(latestAt).getTime()) / 1000)
      : null;
    detail.peg_samples = { latest_at: latestAt, lag_seconds: lagSec };
    if (lagSec != null && lagSec > MAX_PEG_SAMPLE_LAG_SEC) overall = "drift";
  } catch (e) {
    overall = "fail";
  }

  // Persist
  await db.execute(sql`
    INSERT INTO health_checks (check_type, status, detail)
    VALUES ('combined', ${overall}, ${JSON.stringify(detail)}::jsonb)
  `);

  // Webhook fire on drift / fail (idempotent — only on transition from ok would be ideal,
  // but for v1 we fire every time it's not ok)
  if (overall !== "ok") {
    await enqueueWebhookEvent("system.health_drift", {
      status: overall,
      details: detail,
    }, null);
  }

  return { overall, details: detail };
}
