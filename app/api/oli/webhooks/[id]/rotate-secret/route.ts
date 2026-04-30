import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { oliWebhookSubscriptions } from "@/lib/db/schema";
import { requireOwner } from "@/lib/wallet/owner-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/oli/webhooks/[id]/rotate-secret
// Hard cutover: the new secret takes effect immediately for the next dispatch.
// No overlap window in v1 — receivers must be ready to accept new sigs the
// moment they receive a 200 from this endpoint.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await requireOwner(req);
  if (owner instanceof NextResponse) return owner;
  const { id } = await params;

  const newSecret = randomBytes(32).toString("hex");
  const now = new Date();
  const updated = await db
    .update(oliWebhookSubscriptions)
    .set({ signingSecret: newSecret, updatedAt: now })
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

  return NextResponse.json({
    ok: true,
    id: updated[0].id,
    status: updated[0].status,
    signing_secret: newSecret,
    rotated_at: now.toISOString(),
  });
}
