import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { resolveAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ID_RE = /^wh_[a-f0-9]{24}$/;

/** GET /api/v1/webhooks/:id — fetch a single subscription the caller owns. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveAuth(req);
  if (!auth.identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const rows = auth.isAdmin
    ? await db.execute(sql`
        SELECT id, label, url, event_types, stable_filter, active, subscriber_key,
               created_at, last_delivery_at
        FROM webhook_subscriptions
        WHERE id = ${id}
      `)
    : await db.execute(sql`
        SELECT id, label, url, event_types, stable_filter, active, subscriber_key,
               created_at, last_delivery_at
        FROM webhook_subscriptions
        WHERE id = ${id} AND subscriber_key = ${auth.identity}
      `);
  const result = ((rows as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (rows as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;

  if (result.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(result[0]);
}

/** DELETE /api/v1/webhooks/:id — remove a subscription the caller owns.
 * Hard-deletes the row (and associated deliveries cascade via FK if one's set;
 * if not, they're orphaned but harmless — the cron skips any delivery whose
 * subscription is inactive/missing). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveAuth(req);
  if (!auth.identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  // Scope delete to caller unless admin.  We use the execute result's count
  // (drizzle returns rowCount on pg) to distinguish "not yours" from "really
  // gone" — but since both should return 404 to the caller (no info leak
  // about other users' subs), we just check existence with the same where
  // clause and return 404 when nothing matched.
  const deleted = auth.isAdmin
    ? await db.execute(sql`
        DELETE FROM webhook_subscriptions WHERE id = ${id} RETURNING id
      `)
    : await db.execute(sql`
        DELETE FROM webhook_subscriptions
        WHERE id = ${id} AND subscriber_key = ${auth.identity}
        RETURNING id
      `);
  const rows = ((deleted as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (deleted as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;

  if (rows.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, id });
}
