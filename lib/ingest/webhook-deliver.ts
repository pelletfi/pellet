import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { createHmac } from "node:crypto";

const MAX_ATTEMPTS = 6;

// Backoff: 30s, 2m, 10m, 1h, 6h, 24h
function nextBackoffSeconds(attemptNumber: number): number {
  const schedule = [30, 120, 600, 3600, 21600, 86400];
  return schedule[Math.min(attemptNumber, schedule.length - 1)];
}

function signPayload(secret: string, body: string, timestamp: number): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

interface Delivery {
  id: number;
  subscription_id: string;
  event_type: string;
  payload: unknown;
  attempts: number;
}

interface Sub {
  id: string;
  url: string;
  secret: string;
}

export interface DeliverResult {
  attempted: number;
  delivered: number;
  failed: number;
  retried: number;
}

export async function deliverPending(): Promise<DeliverResult> {
  let attempted = 0;
  let delivered = 0;
  let failed = 0;
  let retried = 0;

  // Claim up to 50 pending deliveries whose next_attempt_at has passed
  const claimResult = await db.execute(sql`
    SELECT id, subscription_id, event_type, payload, attempts
    FROM webhook_deliveries
    WHERE status = 'pending'
      AND next_attempt_at <= NOW()
    ORDER BY next_attempt_at ASC
    LIMIT 50
  `);
  const deliveries = ((claimResult as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (claimResult as unknown as Record<string, unknown>[])) as unknown as Delivery[];
  if (deliveries.length === 0) return { attempted, delivered, failed, retried };

  // Fetch subscriptions in bulk
  const subIds = [...new Set(deliveries.map((d) => d.subscription_id))];
  const subs = new Map<string, Sub>();
  for (const id of subIds) {
    const r = await db.execute(sql`
      SELECT id, url, secret FROM webhook_subscriptions
      WHERE id = ${id} AND active = 'true'
      LIMIT 1
    `);
    const rows = ((r as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (r as unknown as Record<string, unknown>[])) as unknown as Sub[];
    if (rows[0]) subs.set(id, rows[0]);
  }

  for (const d of deliveries) {
    attempted += 1;
    const sub = subs.get(d.subscription_id);
    if (!sub) {
      // Subscription disabled or deleted — mark delivery failed
      await db.execute(sql`
        UPDATE webhook_deliveries SET status = 'failed', last_error = 'subscription not active'
        WHERE id = ${d.id}
      `);
      failed += 1;
      continue;
    }

    const body = JSON.stringify({
      event: d.event_type,
      data: d.payload,
      delivery_id: d.id,
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signPayload(sub.secret, body, timestamp);

    try {
      const response = await fetch(sub.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Pellet-Signature": `t=${timestamp},v1=${signature}`,
          "X-Pellet-Event": d.event_type,
          "X-Pellet-Delivery": String(d.id),
          "User-Agent": "Pellet-Webhook/1 (+https://pelletfi.com)",
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (response.status >= 200 && response.status < 300) {
        await db.execute(sql`
          UPDATE webhook_deliveries SET
            status = 'delivered',
            delivered_at = NOW(),
            attempts = attempts + 1
          WHERE id = ${d.id}
        `);
        await db.execute(sql`
          UPDATE webhook_subscriptions SET last_delivery_at = NOW() WHERE id = ${sub.id}
        `);
        delivered += 1;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const newAttempts = d.attempts + 1;
      if (newAttempts >= MAX_ATTEMPTS) {
        await db.execute(sql`
          UPDATE webhook_deliveries SET
            status = 'failed',
            attempts = ${newAttempts},
            last_error = ${msg}
          WHERE id = ${d.id}
        `);
        failed += 1;
      } else {
        const backoff = nextBackoffSeconds(newAttempts - 1);
        await db.execute(sql`
          UPDATE webhook_deliveries SET
            attempts = ${newAttempts},
            next_attempt_at = NOW() + make_interval(secs => ${backoff}),
            last_error = ${msg}
          WHERE id = ${d.id}
        `);
        retried += 1;
      }
    }
  }

  return { attempted, delivered, failed, retried };
}

// Enqueue a webhook event for all matching subscriptions.
// Called by other ingesters (e.g. peg-break-detector when a new event starts).
export async function enqueueWebhookEvent(
  eventType: string,
  payload: Record<string, unknown>,
  stableFilter: string | null,
): Promise<number> {
  const r = await db.execute(sql`
    SELECT id FROM webhook_subscriptions
    WHERE active = 'true'
      AND ${eventType} = ANY(event_types)
      AND (stable_filter IS NULL OR ${stableFilter ?? ""} = ANY(stable_filter))
  `);
  const subs = ((r as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (r as unknown as Record<string, unknown>[])) as Array<{ id: string }>;
  let count = 0;
  for (const s of subs) {
    await db.execute(sql`
      INSERT INTO webhook_deliveries (subscription_id, event_type, payload)
      VALUES (${s.id}, ${eventType}, ${JSON.stringify(payload)}::jsonb)
    `);
    count += 1;
  }
  return count;
}
