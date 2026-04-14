import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { KNOWN_STABLECOINS } from "@/lib/pipeline/stablecoins";
import { enqueueWebhookEvent } from "./webhook-deliver";

// Severity thresholds
const MILD_BPS = 10;
const SEVERE_BPS = 50;
const MILD_MIN_DURATION_SEC = 5 * 60;
const SEVERE_MIN_DURATION_SEC = 60;

// How far back to scan on each detector run.
// Should be >= MILD_MIN_DURATION_SEC so ongoing events are always re-evaluated.
const LOOKBACK_SECONDS = 24 * 60 * 60;

interface Sample {
  sampled_at: string;
  block_number: number;
  spread_bps: number;
}

interface Window {
  severity: "mild" | "severe";
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  maxDeviationBps: number;
  startedBlock: number;
  endedBlock: number | null;
}

function classifyWindow(maxBps: number, durationSec: number): "mild" | "severe" | null {
  if (maxBps > SEVERE_BPS && durationSec >= SEVERE_MIN_DURATION_SEC) return "severe";
  if (maxBps > MILD_BPS && durationSec >= MILD_MIN_DURATION_SEC) return "mild";
  return null;
}

export interface DetectResult {
  stablesScanned: number;
  eventsUpserted: number;
  ongoingEvents: number;
}

export async function detectPegBreaks(): Promise<DetectResult> {
  const since = new Date(Date.now() - LOOKBACK_SECONDS * 1000);
  let eventsUpserted = 0;
  let ongoingEvents = 0;

  for (const stable of KNOWN_STABLECOINS) {
    const addr = stable.address.toLowerCase();
    const result = await db.execute(sql`
      SELECT sampled_at, block_number, spread_bps::float8 AS spread_bps
      FROM peg_samples
      WHERE stable = ${addr}
        AND sampled_at >= ${since.toISOString()}
      ORDER BY sampled_at ASC
    `);
    const rows = ((result as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (result as unknown as Record<string, unknown>[])) as unknown as Sample[];
    if (rows.length === 0) continue;

    // Scan for continuous windows where spread > MILD_BPS (most permissive threshold).
    // Each resulting window gets classified by its max deviation + duration.
    const windows: Window[] = [];
    let active: { start: Sample; max: number } | null = null;
    let lastElevated: Sample | null = null;

    for (const s of rows) {
      if (s.spread_bps > MILD_BPS) {
        if (!active) active = { start: s, max: s.spread_bps };
        else active.max = Math.max(active.max, s.spread_bps);
        lastElevated = s;
      } else {
        if (active && lastElevated) {
          const dur = Math.floor(
            (new Date(lastElevated.sampled_at).getTime() - new Date(active.start.sampled_at).getTime()) / 1000,
          );
          const severity = classifyWindow(active.max, dur);
          if (severity) {
            windows.push({
              severity,
              startedAt: active.start.sampled_at,
              endedAt: lastElevated.sampled_at,
              durationSeconds: dur,
              maxDeviationBps: active.max,
              startedBlock: active.start.block_number,
              endedBlock: lastElevated.block_number,
            });
          }
          active = null;
          lastElevated = null;
        }
      }
    }

    // Trailing open window — event is still ongoing at detector time
    if (active && lastElevated) {
      const dur = Math.floor(
        (new Date(lastElevated.sampled_at).getTime() - new Date(active.start.sampled_at).getTime()) / 1000,
      );
      const severity = classifyWindow(active.max, dur);
      if (severity) {
        windows.push({
          severity,
          startedAt: active.start.sampled_at,
          endedAt: null,
          durationSeconds: dur,
          maxDeviationBps: active.max,
          startedBlock: active.start.block_number,
          endedBlock: null,
        });
        ongoingEvents += 1;
      }
    }

    for (const w of windows) {
      // Check if this event already existed before upsert — we only enqueue webhooks
      // on NEW events (started) or when a previously-open event closes (ended).
      const existingResult = await db.execute(sql`
        SELECT ended_at FROM peg_events
        WHERE stable = ${addr} AND started_at = ${w.startedAt}
        LIMIT 1
      `);
      const existingRows = ((existingResult as unknown as { rows?: Record<string, unknown>[] }).rows
        ?? (existingResult as unknown as Record<string, unknown>[])) as Array<{ ended_at: unknown }>;
      const wasNew = existingRows.length === 0;
      const wasOngoing = existingRows[0]?.ended_at == null;
      const nowClosed = w.endedAt != null;

      await db.execute(sql`
        INSERT INTO peg_events (
          stable, severity, started_at, ended_at, duration_seconds,
          max_deviation_bps, started_block, ended_block
        ) VALUES (
          ${addr}, ${w.severity}, ${w.startedAt}, ${w.endedAt}, ${w.durationSeconds},
          ${w.maxDeviationBps.toFixed(2)}, ${w.startedBlock}, ${w.endedBlock}
        )
        ON CONFLICT (stable, started_at) DO UPDATE SET
          severity = EXCLUDED.severity,
          ended_at = EXCLUDED.ended_at,
          duration_seconds = EXCLUDED.duration_seconds,
          max_deviation_bps = EXCLUDED.max_deviation_bps,
          ended_block = EXCLUDED.ended_block,
          detected_at = NOW()
      `);
      eventsUpserted += 1;

      // Emit webhook events
      if (wasNew) {
        await enqueueWebhookEvent("peg_break.started", {
          stable: addr,
          severity: w.severity,
          started_at: w.startedAt,
          max_deviation_bps: w.maxDeviationBps,
          started_block: w.startedBlock,
        }, addr);
      }
      if (wasOngoing && nowClosed) {
        await enqueueWebhookEvent("peg_break.ended", {
          stable: addr,
          severity: w.severity,
          started_at: w.startedAt,
          ended_at: w.endedAt,
          duration_seconds: w.durationSeconds,
          max_deviation_bps: w.maxDeviationBps,
        }, addr);
      }
    }
  }

  return {
    stablesScanned: KNOWN_STABLECOINS.length,
    eventsUpserted,
    ongoingEvents,
  };
}
