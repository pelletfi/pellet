import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { webhookSubscriptions } from "@/lib/db/schema";
import { requireOwner } from "@/lib/wallet/owner-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/webhooks/[id]/resume — re-arm a paused or auto-disabled sub.
// Resets consecutive_failures so the auto-disable threshold starts fresh.
// pending_verify subs cannot be resumed via this endpoint — they must
// complete /verify first.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await requireOwner(req);
  if (owner instanceof NextResponse) return owner;
  const { id } = await params;

  const rows = await db
    .select()
    .from(webhookSubscriptions)
    .where(
      and(
        eq(webhookSubscriptions.id, id),
        eq(webhookSubscriptions.ownerUserId, owner.userId),
      ),
    )
    .limit(1);
  const sub = rows[0];
  if (!sub || sub.status === "deleted") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (sub.status === "pending_verify") {
    return NextResponse.json(
      { error: "subscription not yet verified", detail: "complete /verify first" },
      { status: 409 },
    );
  }
  if (sub.status === "active") {
    return NextResponse.json({ ok: true, id: sub.id, status: "active", note: "already active" });
  }

  const now = new Date();
  await db
    .update(webhookSubscriptions)
    .set({ status: "active", consecutiveFailures: 0, updatedAt: now })
    .where(eq(webhookSubscriptions.id, sub.id));

  return NextResponse.json({ ok: true, id: sub.id, status: "active" });
}
