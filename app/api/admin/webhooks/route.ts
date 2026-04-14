import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";

function authed(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

// GET — list all subscriptions
export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await db.execute(sql`
    SELECT id, label, url, event_types, stable_filter, active, created_at, last_delivery_at
    FROM webhook_subscriptions
    ORDER BY created_at DESC
  `);
  const rows = ((r as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (r as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
  return NextResponse.json({ subscriptions: rows });
}

// POST — create subscription. Body:
//   { label?: string, url: string, event_types: string[], stable_filter?: string[] }
// Returns the generated id + secret (only time secret is exposed).
export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.url || !Array.isArray(body.event_types)) {
    return NextResponse.json({ error: "missing url or event_types" }, { status: 400 });
  }

  const id = `wh_${randomBytes(12).toString("hex")}`;
  const secret = `whsec_${randomBytes(32).toString("hex")}`;
  const label = body.label ?? null;
  const stableFilter = Array.isArray(body.stable_filter)
    ? body.stable_filter.map((s: string) => s.toLowerCase())
    : null;

  await db.execute(sql`
    INSERT INTO webhook_subscriptions (id, label, url, secret, event_types, stable_filter)
    VALUES (
      ${id}, ${label}, ${body.url}, ${secret},
      ${sql.raw(`ARRAY[${body.event_types.map((e: string) => `'${e.replace(/'/g, "''")}'`).join(",")}]::text[]`)},
      ${stableFilter ? sql.raw(`ARRAY[${stableFilter.map((s: string) => `'${s.replace(/'/g, "''")}'`).join(",")}]::text[]`) : sql.raw("NULL")}
    )
  `);

  return NextResponse.json({ id, secret, url: body.url, event_types: body.event_types }, { status: 201 });
}
