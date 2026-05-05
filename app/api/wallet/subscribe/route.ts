import { NextResponse } from "next/server";
import { requireSession } from "@/lib/wallet/bearer-auth";
import { executePayment } from "@/lib/wallet/execute-payment";
import { getActiveSubscription } from "@/lib/wallet/subscriptions";
import { db } from "@/lib/db/client";
import { walletSubscriptions } from "@/lib/db/schema";
import { rateLimit } from "@/lib/rate-limit";
import { tempoChainConfig } from "@/lib/wallet/tempo-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PRO_PRICE_WEI = "5000000"; // 5 USDC (6 decimals)
const PRO_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function POST(req: Request) {
  const resolved = await requireSession(req, { requireOnChainAuthorize: true });
  if (resolved instanceof NextResponse) return resolved;
  const { session, user } = resolved;

  const rl = rateLimit(`subscribe:${user.id}`, { max: 3, windowMs: 60_000 });
  if (!rl.ok) return rl.response;

  const existing = await getActiveSubscription(user.id);
  if (existing) {
    return NextResponse.json(
      { error: "already subscribed", expires_at: existing.expiresAt.toISOString() },
      { status: 409 },
    );
  }

  const treasury = process.env.PLATFORM_TREASURY_ADDRESS;
  if (!treasury || !/^0x[0-9a-fA-F]{40}$/.test(treasury)) {
    return NextResponse.json({ error: "subscriptions not configured" }, { status: 503 });
  }

  if (!user.publicKeyUncompressed) {
    return NextResponse.json({ error: "wallet user missing on-chain identity" }, { status: 500 });
  }

  const result = await executePayment({
    session,
    user: { ...user, publicKeyUncompressed: user.publicKeyUncompressed },
    to: treasury as `0x${string}`,
    amountWei: BigInt(PRO_PRICE_WEI),
    memo: "subscription:pro",
    token: tempoChainConfig().usdcE,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: result.status },
    );
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + PRO_DURATION_MS);

  const [sub] = await db
    .insert(walletSubscriptions)
    .values({
      userId: user.id,
      plan: "pro",
      amountWei: PRO_PRICE_WEI,
      txHash: result.txHash,
      startsAt: now,
      expiresAt,
    })
    .returning();

  return NextResponse.json({
    ok: true,
    subscription: {
      id: sub.id,
      plan: sub.plan,
      starts_at: sub.startsAt.toISOString(),
      expires_at: sub.expiresAt.toISOString(),
      tx_hash: result.txHash,
      explorer_url: result.explorerUrl,
    },
  });
}
