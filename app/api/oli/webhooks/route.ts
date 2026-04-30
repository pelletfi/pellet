import { NextResponse } from "next/server";
import { after } from "next/server";
import { randomBytes, randomUUID } from "crypto";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { oliWebhookSubscriptions } from "@/lib/db/schema";
import { requireOwner } from "@/lib/wallet/owner-auth";
import { validateCallbackUrl, validateFilter } from "@/lib/oli/webhooks/validation";
import { sendVerifyPing } from "@/lib/oli/webhooks/dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ACTIVE_SUBS_PER_OWNER = 25;
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function newSecretHex(): string {
  // 32 bytes = 256 bits of entropy. Hex-encoded for header / config files.
  return randomBytes(32).toString("hex");
}
function newVerifyToken(): string {
  return randomBytes(16).toString("hex");
}

// POST /api/oli/webhooks — create.
// GET  /api/oli/webhooks — list (no secrets).

type CreateBody = {
  callback_url?: unknown;
  filters?: unknown;
  label?: unknown;
};

export async function POST(req: Request) {
  const owner = await requireOwner(req);
  if (owner instanceof NextResponse) return owner;

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const callbackUrl = validateCallbackUrl(body.callback_url);
  if (typeof callbackUrl !== "string") {
    return NextResponse.json(callbackUrl, { status: 400 });
  }

  const filter = await validateFilter(body.filters);
  if ("error" in filter) {
    return NextResponse.json(filter, { status: 400 });
  }

  const label =
    typeof body.label === "string" && body.label.trim().length > 0
      ? body.label.trim().slice(0, 200)
      : null;

  // Cap active subs per owner. 'deleted' rows don't count; 'pending_verify',
  // 'paused', 'active', 'disabled_by_failures' all count toward the cap.
  const countRow = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*)::text AS count
    FROM oli_webhook_subscriptions
    WHERE owner_user_id = ${owner.userId}
      AND status <> 'deleted'
  `);
  const existing = Number(countRow.rows[0]?.count ?? 0);
  if (existing >= MAX_ACTIVE_SUBS_PER_OWNER) {
    return NextResponse.json(
      {
        error: "subscription cap reached",
        detail: `max ${MAX_ACTIVE_SUBS_PER_OWNER} active subs per owner`,
      },
      { status: 403 },
    );
  }

  const id = randomUUID();
  const signingSecret = newSecretHex();
  const verifyToken = newVerifyToken();
  const now = new Date();
  const verifyExpires = new Date(now.getTime() + VERIFY_TOKEN_TTL_MS);

  await db.insert(oliWebhookSubscriptions).values({
    id,
    ownerUserId: owner.userId,
    callbackUrl,
    signingSecret,
    label,
    filters: filter,
    status: "pending_verify",
    verifyToken,
    verifyTokenExpiresAt: verifyExpires,
    createdAt: now,
    updatedAt: now,
  });

  // Fire the verify ping after the response goes out.
  after(async () => {
    await sendVerifyPing(id);
  });

  return NextResponse.json(
    {
      ok: true,
      id,
      status: "pending_verify",
      callback_url: callbackUrl,
      filters: filter,
      label,
      // surfaced ONCE
      signing_secret: signingSecret,
      verify_token: verifyToken,
      verify_token_expires_at: verifyExpires.toISOString(),
      created_at: now.toISOString(),
    },
    { status: 201 },
  );
}

export async function GET(req: Request) {
  const owner = await requireOwner(req);
  if (owner instanceof NextResponse) return owner;

  const rows = await db
    .select({
      id: oliWebhookSubscriptions.id,
      callbackUrl: oliWebhookSubscriptions.callbackUrl,
      label: oliWebhookSubscriptions.label,
      filters: oliWebhookSubscriptions.filters,
      status: oliWebhookSubscriptions.status,
      consecutiveFailures: oliWebhookSubscriptions.consecutiveFailures,
      verifiedAt: oliWebhookSubscriptions.verifiedAt,
      createdAt: oliWebhookSubscriptions.createdAt,
      updatedAt: oliWebhookSubscriptions.updatedAt,
      lastDeliveredAt: oliWebhookSubscriptions.lastDeliveredAt,
    })
    .from(oliWebhookSubscriptions)
    .where(
      and(
        eq(oliWebhookSubscriptions.ownerUserId, owner.userId),
        ne(oliWebhookSubscriptions.status, "deleted"),
      ),
    )
    .orderBy(desc(oliWebhookSubscriptions.createdAt));

  return NextResponse.json({
    ok: true,
    subscriptions: rows.map((r) => ({
      id: r.id,
      callback_url: r.callbackUrl,
      label: r.label,
      filters: r.filters,
      status: r.status,
      consecutive_failures: r.consecutiveFailures,
      verified_at: r.verifiedAt?.toISOString() ?? null,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
      last_delivered_at: r.lastDeliveredAt?.toISOString() ?? null,
    })),
  });
}
