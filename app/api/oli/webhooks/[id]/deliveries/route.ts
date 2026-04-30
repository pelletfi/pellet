import { NextResponse } from "next/server";
import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { oliWebhookDeliveries, oliWebhookSubscriptions } from "@/lib/db/schema";
import { requireOwner } from "@/lib/wallet/owner-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/oli/webhooks/[id]/deliveries?limit=&before_id=
// Paginated by created_at desc; cursor uses the row's id (uuid) and we
// resolve before by created_at + id ordering. Simple keyset on created_at
// is fine for v1 since we expect limited delivery volume per sub.

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await requireOwner(req);
  if (owner instanceof NextResponse) return owner;
  const { id } = await params;

  // Verify ownership.
  const ownership = await db
    .select({ id: oliWebhookSubscriptions.id })
    .from(oliWebhookSubscriptions)
    .where(
      and(
        eq(oliWebhookSubscriptions.id, id),
        eq(oliWebhookSubscriptions.ownerUserId, owner.userId),
      ),
    )
    .limit(1);
  if (ownership.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const beforeIso = url.searchParams.get("before_created_at");
  const before = beforeIso ? new Date(beforeIso) : null;
  if (before && Number.isNaN(before.getTime())) {
    return NextResponse.json(
      { error: "before_created_at must be ISO-8601" },
      { status: 400 },
    );
  }

  const conditions = [eq(oliWebhookDeliveries.subscriptionId, id)];
  if (before) conditions.push(lt(oliWebhookDeliveries.createdAt, before));

  const rows = await db
    .select()
    .from(oliWebhookDeliveries)
    .where(and(...conditions))
    .orderBy(desc(oliWebhookDeliveries.createdAt))
    .limit(limit);

  const lastCreatedAt = rows.length > 0 ? rows[rows.length - 1].createdAt : null;

  return NextResponse.json({
    ok: true,
    subscription_id: id,
    count: rows.length,
    next_before_created_at:
      rows.length === limit && lastCreatedAt ? lastCreatedAt.toISOString() : null,
    deliveries: rows.map((r) => ({
      id: r.id,
      delivery_id: r.deliveryId,
      event_id: r.eventId,
      attempt_count: r.attemptCount,
      status: r.status,
      response_code: r.responseCode,
      response_body_excerpt: r.responseBodyExcerpt,
      next_retry_at: r.nextRetryAt?.toISOString() ?? null,
      delivered_at: r.deliveredAt?.toISOString() ?? null,
      last_attempt_at: r.lastAttemptAt?.toISOString() ?? null,
      last_error: r.lastError,
      created_at: r.createdAt.toISOString(),
    })),
  });
}
