import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

// Wraps a cron handler function so every invocation is recorded in cron_runs.
// Use in route handlers like:
//   const result = await runCron("ingest", () => processEvents());
export async function runCron<T>(
  cronName: string,
  handler: () => Promise<T>,
): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  const startedAt = new Date();
  const t0 = Date.now();
  try {
    const result = await handler();
    const durationMs = Date.now() - t0;
    await db.execute(sql`
      INSERT INTO cron_runs (cron_name, status, duration_ms, detail, started_at)
      VALUES (${cronName}, 'ok', ${durationMs}, ${JSON.stringify(result)}::jsonb, ${startedAt.toISOString()})
    `).catch(() => {});
    return { ok: true, result };
  } catch (e) {
    const durationMs = Date.now() - t0;
    const message = e instanceof Error ? e.message : String(e);
    await db.execute(sql`
      INSERT INTO cron_runs (cron_name, status, duration_ms, detail, error, started_at)
      VALUES (${cronName}, 'error', ${durationMs}, NULL, ${message}, ${startedAt.toISOString()})
    `).catch(() => {});
    return { ok: false, error: message };
  }
}
