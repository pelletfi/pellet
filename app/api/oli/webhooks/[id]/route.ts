import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { oliWebhookSubscriptions } from "@/lib/db/schema";
import { requireOwner } from "@/lib/wallet/owner-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET    /api/oli/webhooks/[id] — detail with delivery counts.
// DELETE /api/oli/webhooks/[id] — soft-delete (status='deleted').

type DeliveryCounts = {
  delivered: number;
  retry: number;
  dead: number;
  queued: number;
};

async function ownedSubscription(
  id: string,
  ownerUserId: string,
): Promise<typeof oliWebhookSubscriptions.$inferSelect | null> {
  const rows = await db
    .select()
    .from(oliWebhookSubscriptions)
    .where(
      and(
        eq(oliWebhookSubscriptions.id, id),
        eq(oliWebhookSubscriptions.ownerUserId, ownerUserId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function deliveryCounts(subscriptionId: string): Promise<DeliveryCounts> {
  const rows = await db.execute<{ status: string; count: string }>(sql`
    SELECT status, COUNT(*)::text AS count
    FROM oli_webhook_deliveries
    WHERE subscription_id = ${subscriptionId}
    GROUP BY status
  `);
  const counts: DeliveryCounts = { delivered: 0, retry: 0, dead: 0, queued: 0 };
  for (const r of rows.rows) {
    if (r.status === "delivered") counts.delivered = Number(r.count);
    else if (r.status === "retry") counts.retry = Number(r.count);
    else if (r.status === "dead") counts.dead = Number(r.count);
    else if (r.status === "queued") counts.queued = Number(r.count);
  }
  return counts;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await requireOwner(req);
  if (owner instanceof NextResponse) return owner;
  const { id } = await params;

  const sub = await ownedSubscription(id, owner.userId);
  if (!sub || sub.status === "deleted") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const counts = await deliveryCounts(sub.id);

  return NextResponse.json({
    ok: true,
    id: sub.id,
    callback_url: sub.callbackUrl,
    label: sub.label,
    filters: sub.filters,
    status: sub.status,
    consecutive_failures: sub.consecutiveFailures,
    verified_at: sub.verifiedAt?.toISOString() ?? null,
    created_at: sub.createdAt.toISOString(),
    updated_at: sub.updatedAt.toISOString(),
    last_delivered_at: sub.lastDeliveredAt?.toISOString() ?? null,
    deliveries: counts,
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await requireOwner(req);
  if (owner instanceof NextResponse) return owner;
  const { id } = await params;

  const updated = await db
    .update(oliWebhookSubscriptions)
    .set({ status: "deleted", updatedAt: new Date() })
    .where(
      and(
        eq(oliWebhookSubscriptions.id, id),
        eq(oliWebhookSubscriptions.ownerUserId, owner.userId),
      ),
    )
    .returning({ id: oliWebhookSubscriptions.id, status: oliWebhookSubscriptions.status });

  if (updated.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, id: updated[0].id, status: updated[0].status });
}
