import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { oliWebhookSubscriptions } from "@/lib/db/schema";
import { requireOwner } from "@/lib/wallet/owner-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/oli/webhooks/[id]/pause — owner-initiated pause. Future events
// won't dispatch until /resume is called.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await requireOwner(req);
  if (owner instanceof NextResponse) return owner;
  const { id } = await params;

  const now = new Date();
  const updated = await db
    .update(oliWebhookSubscriptions)
    .set({ status: "paused", updatedAt: now })
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
