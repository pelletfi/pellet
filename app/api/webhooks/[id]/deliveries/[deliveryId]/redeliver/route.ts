import { NextResponse } from "next/server";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { webhookDeliveries, webhookSubscriptions } from "@/lib/db/schema";
import { requireOwner } from "@/lib/wallet/owner-auth";
import { attemptDelivery } from "@/lib/wallet/webhooks/dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/webhooks/[id]/deliveries/[deliveryId]/redeliver
// Forces a fresh attempt on a delivery row regardless of its current status
// (delivered/dead/retry). Resets the row to 'queued' and fires after the
// response goes out so the user gets immediate feedback.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; deliveryId: string }> },
) {
  const owner = await requireOwner(req);
  if (owner instanceof NextResponse) return owner;
  const { id, deliveryId } = await params;

  // Confirm the subscription is owned by the caller.
  const subRow = await db
    .select({ id: webhookSubscriptions.id, status: webhookSubscriptions.status })
    .from(webhookSubscriptions)
    .where(
      and(
        eq(webhookSubscriptions.id, id),
        eq(webhookSubscriptions.ownerUserId, owner.userId),
      ),
    )
    .limit(1);
  if (subRow.length === 0 || subRow[0].status === "deleted") {
    return NextResponse.json({ error: "subscription not found" }, { status: 404 });
  }
  if (subRow[0].status !== "active") {
    return NextResponse.json(
      { error: "subscription not active", detail: subRow[0].status },
      { status: 409 },
    );
  }

  // Locate the delivery row (allow lookup by either pk id or stable delivery_id).
  const delivery = await db
    .select()
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.subscriptionId, id),
        eq(webhookDeliveries.id, deliveryId),
      ),
    )
    .limit(1);
  if (delivery.length === 0) {
    return NextResponse.json({ error: "delivery not found" }, { status: 404 });
  }

  // Reset the row so attemptDelivery will run it.
  await db
    .update(webhookDeliveries)
    .set({
      status: "queued",
      nextRetryAt: null,
      lastError: null,
    })
    .where(eq(webhookDeliveries.id, delivery[0].id));

  after(async () => {
    await attemptDelivery(delivery[0].id).catch(() => {});
  });

  return NextResponse.json({ ok: true, delivery_id: delivery[0].id, status: "queued" });
}
