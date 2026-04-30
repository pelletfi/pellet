import { db } from "@/lib/db/client";
import { cronRuns } from "@/lib/db/schema";
import { bus } from "@/lib/realtime/bus";

// Wraps a cron handler so every invocation is recorded in cron_runs with
// duration + status + (on success) the result payload + (on error) the message.
// Use in route handlers like:
//   const wrapped = await runCron("ingest", () => processEvents());
export async function runCron<T>(
  cronName: string,
  handler: () => Promise<T>,
): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  const startedAt = new Date();
  const t0 = Date.now();
  // Make sure the LISTEN connection for the realtime bus is alive — otherwise
  // webhook dispatch from NOTIFY-driven events can be missed inside cron-only
  // runs of this process. Idempotent: bus().start() short-circuits after first call.
  await bus().start().catch(() => {});
  try {
    const result = await handler();
    const durationMs = Date.now() - t0;
    await db
      .insert(cronRuns)
      .values({
        cronName,
        status: "ok",
        durationMs,
        detail: result as object,
        startedAt,
      })
      .catch(() => {});
    return { ok: true, result };
  } catch (e) {
    const durationMs = Date.now() - t0;
    const message = e instanceof Error ? e.message : String(e);
    await db
      .insert(cronRuns)
      .values({
        cronName,
        status: "error",
        durationMs,
        error: message,
        startedAt,
      })
      .catch(() => {});
    return { ok: false, error: message };
  }
}
