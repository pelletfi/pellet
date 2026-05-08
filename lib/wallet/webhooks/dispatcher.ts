import { db } from "@/lib/db/client";
import { agents, agentEvents, webhookSubscriptions, webhookDeliveries } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { RecentEventRow } from "@/lib/wallet/queries";
import { buildEnvelope, buildEventData, buildVerifyEnvelope } from "./payload";
import { signNow, SIGNATURE_HEADER } from "./signature";
import { nextRetryAt } from "./retry-schedule";

// ── Constants ─────────────────────────────────────────────────────────────

const FAILURE_DISABLE_THRESHOLD = 5;
const RESPONSE_BODY_EXCERPT_LIMIT = 1024;
const FETCH_CONNECT_TIMEOUT_MS = 5_000;
const FETCH_TOTAL_TIMEOUT_MS = 10_000;
const USER_AGENT = "Pellet-Webhooks/1.0";

// ── Internal types ────────────────────────────────────────────────────────

type WebhookFilter = {
  agent_id: string;
  recipient_address?: string;
  routed_to_address?: string;
  min_amount_wei?: string;
  token_address?: string;
};

type SubscriptionRow = typeof webhookSubscriptions.$inferSelect;
type DeliveryRow = typeof webhookDeliveries.$inferSelect;

// ── Event hydration ───────────────────────────────────────────────────────

async function fetchEventForWebhook(id: number): Promise<RecentEventRow | null> {
  const rows = await db.execute<{
    id: number;
    ts: Date | string;
    agent_id: string;
    agent_label: string;
    agent_category: string | null;
    counterparty_address: string | null;
    counterparty_label: string | null;
    counterparty_category: string | null;
    kind: string;
    amount_wei: string | null;
    token_address: string | null;
    tx_hash: string;
    source_block: number;
    methodology_version: string;
    routed_to_address: string | null;
    routed_to_label: string | null;
    routed_fingerprint: string | null;
  }>(sql`
    SELECT
      ae.id::int                              AS id,
      ae.ts                                   AS ts,
      ae.agent_id                             AS agent_id,
      a.label                                 AS agent_label,
      (a.links ->> 'category')                AS agent_category,
      ae.counterparty_address                 AS counterparty_address,
      cl.label                                AS counterparty_label,
      cl.category                             AS counterparty_category,
      ae.kind                                 AS kind,
      ae.amount_wei                           AS amount_wei,
      ae.token_address                        AS token_address,
      ae.tx_hash                              AS tx_hash,
      ae.source_block::int                    AS source_block,
      ae.methodology_version                  AS methodology_version,
      ae.routed_to_address                    AS routed_to_address,
      rl.label                                AS routed_to_label,
      ae.routed_fingerprint                   AS routed_fingerprint
    FROM agent_events ae
    JOIN agents a ON a.id = ae.agent_id
    LEFT JOIN address_labels cl ON cl.address = LOWER(ae.counterparty_address)
    LEFT JOIN address_labels rl ON rl.address = LOWER(ae.routed_to_address)
    WHERE ae.id = ${id}
    LIMIT 1
  `);
  if (rows.rows.length === 0) return null;
  const r = rows.rows[0];
  return {
    id: r.id,
    ts: r.ts instanceof Date ? r.ts : new Date(r.ts as string),
    agentId: r.agent_id,
    agentLabel: r.agent_label,
    agentCategory: r.agent_category,
    counterpartyAddress: r.counterparty_address,
    counterpartyLabel: r.counterparty_label,
    counterpartyCategory: r.counterparty_category,
    kind: r.kind,
    amountWei: r.amount_wei,
    tokenAddress: r.token_address,
    txHash: r.tx_hash,
    sourceBlock: r.source_block,
    methodologyVersion: r.methodology_version,
    routedToAddress: r.routed_to_address,
    routedToLabel: r.routed_to_label,
    routedFingerprint: r.routed_fingerprint,
  };
}

// ── Filter matching ───────────────────────────────────────────────────────

export function matchesFilter(filter: WebhookFilter, event: RecentEventRow): boolean {
  if (filter.agent_id !== event.agentId) return false;
  if (
    filter.recipient_address &&
    event.counterpartyAddress?.toLowerCase() !== filter.recipient_address.toLowerCase()
  ) {
    return false;
  }
  if (
    filter.routed_to_address &&
    event.routedToAddress?.toLowerCase() !== filter.routed_to_address.toLowerCase()
  ) {
    return false;
  }
  if (
    filter.token_address &&
    event.tokenAddress?.toLowerCase() !== filter.token_address.toLowerCase()
  ) {
    return false;
  }
  if (filter.min_amount_wei) {
    if (!event.amountWei) return false;
    try {
      if (BigInt(event.amountWei) < BigInt(filter.min_amount_wei)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

// ── Dispatch (fan-out from event_id → delivery rows + first attempt) ─────

/**
 * Insert delivery rows for every active subscription matching `eventId`,
 * then schedule first-attempt fires. Idempotent — the (subscription_id,
 * event_id) unique index makes the bus + match-runner double-call safe.
 *
 * Callers should NOT await this if they're on a request-serving path; use
 * `void dispatchToWebhooks(id).catch(...)` to keep response latency clean.
 * The retry cron picks up anything that didn't fire here.
 */
export async function dispatchToWebhooks(eventId: number): Promise<void> {
  const event = await fetchEventForWebhook(eventId);
  if (!event) return;

  // Pull only subscriptions that COULD match: status='active', and either
  // no recipient filter OR the recipient matches the event's counterparty.
  // Other filters (token, amount, routed_to) are checked in matchesFilter
  // since they don't have indexes today.
  const candidateRows = await db.execute<{
    id: string;
    callback_url: string;
    signing_secret: string;
    filters: WebhookFilter;
    status: string;
  }>(sql`
    SELECT id, callback_url, signing_secret, filters::jsonb AS filters, status
    FROM webhook_subscriptions
    WHERE status = 'active'
      AND (filters ->> 'agent_id') = ${event.agentId}
      AND (
        (filters ->> 'recipient_address') IS NULL
        OR LOWER(filters ->> 'recipient_address') = LOWER(${event.counterpartyAddress ?? ""})
      )
  `);

  if (candidateRows.rows.length === 0) return;

  const matching = candidateRows.rows.filter((s) =>
    matchesFilter(s.filters, event),
  );
  if (matching.length === 0) return;

  // Bulk-insert delivery rows; ON CONFLICT keeps the existing row.
  // RETURNING tells us which inserts actually happened (not conflicts).
  const inserted = await db
    .insert(webhookDeliveries)
    .values(
      matching.map((s) => ({
        subscriptionId: s.id,
        eventId,
        status: "queued" as const,
      })),
    )
    .onConflictDoNothing({
      target: [webhookDeliveries.subscriptionId, webhookDeliveries.eventId],
    })
    .returning({ id: webhookDeliveries.id });

  // Fire first attempts in parallel — each catches its own errors.
  await Promise.all(inserted.map((d) => attemptDelivery(d.id).catch(() => {})));
}

// ── Single attempt (POST + status code branching) ────────────────────────

type AttemptOutcome =
  | { kind: "success"; code: number; bodyExcerpt: string }
  | { kind: "gone"; code: number; bodyExcerpt: string }
  | { kind: "retry"; code: number | null; reason: string; bodyExcerpt: string }
  | { kind: "dead"; code: number; reason: string; bodyExcerpt: string };

function truncateBody(s: string): string {
  return s.length > RESPONSE_BODY_EXCERPT_LIMIT
    ? s.slice(0, RESPONSE_BODY_EXCERPT_LIMIT)
    : s;
}

async function postWithTimeout(
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<{ ok: true; res: Response } | { ok: false; reason: string }> {
  const controller = new AbortController();
  // Total budget. The connect timeout is enforced separately by the runtime
  // (Node's fetch maps DNS/connect failures into AbortError or fetch errors;
  // we apply the same overall ceiling regardless).
  const totalT = setTimeout(() => controller.abort(new Error("total-timeout")), FETCH_TOTAL_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    return { ok: true, res };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: message };
  } finally {
    clearTimeout(totalT);
  }
}

async function classifyResponse(
  res: Response,
): Promise<AttemptOutcome> {
  const code = res.status;
  let bodyText = "";
  try {
    bodyText = await res.text();
  } catch {
    // body read failed — keep classification on status alone
  }
  const excerpt = truncateBody(bodyText);

  if (code >= 200 && code < 300) {
    return { kind: "success", code, bodyExcerpt: excerpt };
  }
  if (code === 410) {
    return { kind: "gone", code, bodyExcerpt: excerpt };
  }
  if (code === 429 || (code >= 500 && code < 600)) {
    return { kind: "retry", code, reason: `http_${code}`, bodyExcerpt: excerpt };
  }
  // Other 4xx → permanent reject; do NOT bump consecutive_failures.
  return { kind: "dead", code, reason: `http_${code}`, bodyExcerpt: excerpt };
}

async function loadDelivery(id: string): Promise<DeliveryRow | null> {
  const rows = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, id))
    .limit(1);
  return rows[0] ?? null;
}

async function loadSubscription(id: string): Promise<SubscriptionRow | null> {
  const rows = await db
    .select()
    .from(webhookSubscriptions)
    .where(eq(webhookSubscriptions.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Run a single delivery attempt: build the payload, sign it, POST, classify
 * the response, update the delivery row + subscription counters.
 *
 * Safe to call concurrently. The cron uses this to walk the retry queue.
 */
export async function attemptDelivery(deliveryId: string): Promise<void> {
  const delivery = await loadDelivery(deliveryId);
  if (!delivery) return;
  if (delivery.status === "delivered" || delivery.status === "dead") return;

  const subscription = await loadSubscription(delivery.subscriptionId);
  if (!subscription) {
    // Subscription was hard-deleted under us. Mark dead so the retry cron
    // doesn't keep picking the row up (cascade should normally clean up first).
    await db
      .update(webhookDeliveries)
      .set({ status: "dead", lastError: "subscription_missing" })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }
  // Skip dispatch for non-active subscriptions; mark the row dead so we
  // don't keep cycling through it. (Resume re-fires fresh deliveries via
  // the next event; we don't replay queued rows on resume.)
  if (subscription.status !== "active") {
    await db
      .update(webhookDeliveries)
      .set({ status: "dead", lastError: `sub_status_${subscription.status}` })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }

  const event = await fetchEventForWebhook(delivery.eventId);
  if (!event) {
    // Event gone — bail without bumping counters. Cascade FK should clean up.
    await db
      .update(webhookDeliveries)
      .set({ status: "dead", lastError: "event_missing" })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }

  const data = buildEventData(event);
  const envelope = buildEnvelope({
    deliveryId: delivery.deliveryId,
    subscriptionId: subscription.id,
    data,
  });
  const rawBody = JSON.stringify(envelope);
  const sig = signNow(subscription.signingSecret, rawBody);

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": USER_AGENT,
    "Pellet-Delivery": delivery.deliveryId,
    "Pellet-Subscription": subscription.id,
    "Pellet-Event-Id": String(event.id),
    [SIGNATURE_HEADER]: sig,
  };

  const attemptStarted = new Date();
  const newAttemptCount = delivery.attemptCount + 1;

  const resp = await postWithTimeout(subscription.callbackUrl, headers, rawBody);

  let outcome: AttemptOutcome;
  if (!resp.ok) {
    outcome = { kind: "retry", code: null, reason: resp.reason, bodyExcerpt: "" };
  } else {
    outcome = await classifyResponse(resp.res);
  }

  await applyOutcome({
    delivery,
    subscription,
    outcome,
    attemptCount: newAttemptCount,
    attemptedAt: attemptStarted,
  });
}

// ── Outcome → DB transitions ──────────────────────────────────────────────

async function applyOutcome(args: {
  delivery: DeliveryRow;
  subscription: SubscriptionRow;
  outcome: AttemptOutcome;
  attemptCount: number;
  attemptedAt: Date;
}): Promise<void> {
  const { delivery, subscription, outcome, attemptCount, attemptedAt } = args;

  if (outcome.kind === "success") {
    await db.transaction(async (tx) => {
      await tx
        .update(webhookDeliveries)
        .set({
          status: "delivered",
          attemptCount,
          responseCode: outcome.code,
          responseBodyExcerpt: outcome.bodyExcerpt || null,
          deliveredAt: attemptedAt,
          lastAttemptAt: attemptedAt,
          nextRetryAt: null,
          lastError: null,
        })
        .where(eq(webhookDeliveries.id, delivery.id));
      await tx
        .update(webhookSubscriptions)
        .set({
          consecutiveFailures: 0,
          lastDeliveredAt: attemptedAt,
          updatedAt: attemptedAt,
        })
        .where(eq(webhookSubscriptions.id, subscription.id));
    });
    return;
  }

  if (outcome.kind === "gone") {
    // 410 Gone → callback explicitly retired. Pause subscription, mark dead.
    await db.transaction(async (tx) => {
      await tx
        .update(webhookDeliveries)
        .set({
          status: "dead",
          attemptCount,
          responseCode: outcome.code,
          responseBodyExcerpt: outcome.bodyExcerpt || null,
          lastAttemptAt: attemptedAt,
          nextRetryAt: null,
          lastError: "http_410_gone",
        })
        .where(eq(webhookDeliveries.id, delivery.id));
      await tx
        .update(webhookSubscriptions)
        .set({ status: "paused", updatedAt: attemptedAt })
        .where(eq(webhookSubscriptions.id, subscription.id));
    });
    return;
  }

  if (outcome.kind === "dead") {
    // Other 4xx — permanent reject. Don't bump consecutive_failures (the
    // problem is with the payload, not the server, so it shouldn't disable
    // future deliveries).
    await db
      .update(webhookDeliveries)
      .set({
        status: "dead",
        attemptCount,
        responseCode: outcome.code,
        responseBodyExcerpt: outcome.bodyExcerpt || null,
        lastAttemptAt: attemptedAt,
        nextRetryAt: null,
        lastError: outcome.reason,
      })
      .where(eq(webhookDeliveries.id, delivery.id));
    return;
  }

  // outcome.kind === "retry"
  const next = nextRetryAt(attemptCount, attemptedAt);
  if (next) {
    await db
      .update(webhookDeliveries)
      .set({
        status: "retry",
        attemptCount,
        responseCode: outcome.code,
        responseBodyExcerpt: outcome.bodyExcerpt || null,
        lastAttemptAt: attemptedAt,
        nextRetryAt: next,
        lastError: outcome.reason,
      })
      .where(eq(webhookDeliveries.id, delivery.id));
    return;
  }

  // No more retries — dead. Bump consecutive_failures; if we cross the
  // threshold, flip the subscription to disabled_by_failures.
  const nextFailures = subscription.consecutiveFailures + 1;
  const newSubStatus =
    subscription.status === "active" && nextFailures >= FAILURE_DISABLE_THRESHOLD
      ? "disabled_by_failures"
      : subscription.status;
  await db.transaction(async (tx) => {
    await tx
      .update(webhookDeliveries)
      .set({
        status: "dead",
        attemptCount,
        responseCode: outcome.code,
        responseBodyExcerpt: outcome.bodyExcerpt || null,
        lastAttemptAt: attemptedAt,
        nextRetryAt: null,
        lastError: outcome.reason,
      })
      .where(eq(webhookDeliveries.id, delivery.id));
    await tx
      .update(webhookSubscriptions)
      .set({
        consecutiveFailures: nextFailures,
        status: newSubStatus,
        updatedAt: attemptedAt,
      })
      .where(eq(webhookSubscriptions.id, subscription.id));
  });
}

// ── Verify ping (fired once on subscription create) ──────────────────────

/**
 * POST a verify envelope to the callback URL signed with the new signing
 * secret. The receiver echoes back `verify_token` to /verify to flip status
 * to 'active'. Until then dispatchToWebhooks skips this subscription.
 *
 * Fire-and-forget; errors are swallowed because the user's UX is governed
 * by the resulting status check, not by what this fn returns.
 */
export async function sendVerifyPing(subscriptionId: string): Promise<void> {
  const sub = await loadSubscription(subscriptionId);
  if (!sub || !sub.verifyToken) return;

  const envelope = buildVerifyEnvelope({
    subscriptionId: sub.id,
    verifyToken: sub.verifyToken,
  });
  const rawBody = JSON.stringify(envelope);
  const sig = signNow(sub.signingSecret, rawBody);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": USER_AGENT,
    "Pellet-Subscription": sub.id,
    [SIGNATURE_HEADER]: sig,
  };
  await postWithTimeout(sub.callbackUrl, headers, rawBody).catch(() => {});
}

// ── Retry cron driver ────────────────────────────────────────────────────

export async function processRetryQueue(limit = 100): Promise<{ attempted: number }> {
  const due = await db
    .select({ id: webhookDeliveries.id })
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.status, "retry"),
        sql`${webhookDeliveries.nextRetryAt} <= now()`,
      ),
    )
    .orderBy(webhookDeliveries.nextRetryAt)
    .limit(limit);

  for (const row of due) {
    try {
      await attemptDelivery(row.id);
    } catch {
      // Per-row failure shouldn't kill the cron run — the row stays in
      // 'retry' state and the next tick re-tries.
    }
  }
  return { attempted: due.length };
}

// Re-export so consumers don't need to know about agents/agentEvents being
// referenced for the schema imports above.
void agents;
void agentEvents;
