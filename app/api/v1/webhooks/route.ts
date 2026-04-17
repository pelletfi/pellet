import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { resolveAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Known event types — keep in sync with the publishers in:
//   lib/ingest/peg-break-detector.ts       → peg_break.started / peg_break.ended
//   lib/ingest/flow-anomaly-detector.ts    → flow_anomaly.detected
//   lib/ingest/health-monitor.ts           → system.health_drift
//   lib/ingest/tip403-admin-indexer.ts     → tip403.policy_created / policy_admin_changed
// Unrecognised event types are rejected to avoid silent typos that miss
// deliveries — OLI discipline: fail loud, not silent.
const KNOWN_EVENTS = [
  "peg_break.started",
  "peg_break.ended",
  "flow_anomaly.detected",
  "system.health_drift",
  "tip403.policy_created",
  "tip403.policy_admin_changed",
] as const;

function validateEvents(events: unknown): string[] | null {
  if (!Array.isArray(events) || events.length === 0) return null;
  const out: string[] = [];
  for (const e of events) {
    if (typeof e !== "string") return null;
    if (!(KNOWN_EVENTS as readonly string[]).includes(e)) return null;
    out.push(e);
  }
  return out;
}

/** GET /api/v1/webhooks — list the caller's subscriptions.  Admin callers
 * see every subscription (including those created via the admin endpoint);
 * Pellet Pro callers see only their own.  Secret is never returned — only
 * exposed on creation. */
export async function GET(req: Request) {
  const auth = await resolveAuth(req);
  if (!auth.identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = auth.isAdmin
    ? await db.execute(sql`
        SELECT id, label, url, event_types, stable_filter, active, subscriber_key,
               created_at, last_delivery_at
        FROM webhook_subscriptions
        ORDER BY created_at DESC
      `)
    : await db.execute(sql`
        SELECT id, label, url, event_types, stable_filter, active, subscriber_key,
               created_at, last_delivery_at
        FROM webhook_subscriptions
        WHERE subscriber_key = ${auth.identity}
        ORDER BY created_at DESC
      `);
  const subs = ((rows as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (rows as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;

  return NextResponse.json({ subscriptions: subs });
}

/** POST /api/v1/webhooks — register a new subscription.
 * Body: { url: string, event_types: string[], label?: string, stable_filter?: string[] }
 * Returns the generated id + secret (the ONLY time secret is exposed — store it
 * at creation or rotate by deleting and re-creating). */
export async function POST(req: Request) {
  const auth = await resolveAuth(req);
  if (!auth.identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (typeof body.url !== "string" || !body.url.startsWith("http")) {
    return NextResponse.json(
      { error: "url must be an http(s) URL" },
      { status: 400 },
    );
  }
  const validEvents = validateEvents(body.event_types);
  if (!validEvents) {
    return NextResponse.json(
      { error: `event_types must be a non-empty array of: ${KNOWN_EVENTS.join(", ")}` },
      { status: 400 },
    );
  }

  const id = `wh_${randomBytes(12).toString("hex")}`;
  const secret = `whsec_${randomBytes(32).toString("hex")}`;
  const label = typeof body.label === "string" ? body.label : null;
  const stableFilter = Array.isArray(body.stable_filter)
    ? (body.stable_filter.filter((s) => typeof s === "string") as string[]).map((s) =>
        s.toLowerCase(),
      )
    : null;
  const subscriberKey = auth.isAdmin ? null : auth.identity;

  await db.execute(sql`
    INSERT INTO webhook_subscriptions (
      id, label, url, secret, event_types, stable_filter, subscriber_key
    ) VALUES (
      ${id}, ${label}, ${body.url}, ${secret},
      ${sql.raw(`ARRAY[${validEvents.map((e) => `'${e.replace(/'/g, "''")}'`).join(",")}]::text[]`)},
      ${stableFilter ? sql.raw(`ARRAY[${stableFilter.map((s) => `'${s.replace(/'/g, "''")}'`).join(",")}]::text[]`) : sql.raw("NULL")},
      ${subscriberKey}
    )
  `);

  return NextResponse.json(
    {
      id,
      secret,
      url: body.url,
      event_types: validEvents,
      stable_filter: stableFilter,
      label,
    },
    { status: 201 },
  );
}
