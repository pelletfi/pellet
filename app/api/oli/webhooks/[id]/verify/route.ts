import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { oliWebhookSubscriptions } from "@/lib/db/schema";
import { requireOwner } from "@/lib/wallet/owner-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/oli/webhooks/[id]/verify  body: { verify_token }
// Flips status pending_verify → active when the token matches and hasn't expired.

type VerifyBody = { verify_token?: unknown };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await requireOwner(req);
  if (owner instanceof NextResponse) return owner;
  const { id } = await params;

  let body: VerifyBody;
  try {
    body = (await req.json()) as VerifyBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const tokenIn = typeof body.verify_token === "string" ? body.verify_token : null;
  if (!tokenIn) {
    return NextResponse.json({ error: "verify_token required" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(oliWebhookSubscriptions)
    .where(
      and(
        eq(oliWebhookSubscriptions.id, id),
        eq(oliWebhookSubscriptions.ownerUserId, owner.userId),
      ),
    )
    .limit(1);
  const sub = rows[0];
  if (!sub || sub.status === "deleted") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (sub.status === "active") {
    return NextResponse.json({ ok: true, id: sub.id, status: "active", note: "already verified" });
  }
  if (sub.status !== "pending_verify") {
    return NextResponse.json(
      { error: "subscription not in pending_verify state", detail: sub.status },
      { status: 409 },
    );
  }
  if (
    !sub.verifyToken ||
    sub.verifyToken !== tokenIn ||
    !sub.verifyTokenExpiresAt ||
    sub.verifyTokenExpiresAt.getTime() < Date.now()
  ) {
    return NextResponse.json({ error: "verify_token invalid or expired" }, { status: 400 });
  }

  const now = new Date();
  await db
    .update(oliWebhookSubscriptions)
    .set({
      status: "active",
      verifiedAt: now,
      verifyToken: null,
      verifyTokenExpiresAt: null,
      updatedAt: now,
    })
    .where(eq(oliWebhookSubscriptions.id, sub.id));

  return NextResponse.json({ ok: true, id: sub.id, status: "active", verified_at: now.toISOString() });
}
