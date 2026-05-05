import { NextResponse } from "next/server";
import { requireSession } from "@/lib/wallet/bearer-auth";
import { executePayment } from "@/lib/wallet/execute-payment";
import { isAddress } from "viem";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PayBody = {
  to: `0x${string}`;
  amount_wei: string;
  memo?: string | null;
  token?: `0x${string}`;
};

export async function POST(req: Request) {
  const resolved = await requireSession(req, { requireOnChainAuthorize: true });
  if (resolved instanceof NextResponse) return resolved;
  const { session, user } = resolved;

  const rl = rateLimit(`pay:${user.id}`, { max: 10, windowMs: 60_000 });
  if (!rl.ok) return rl.response;

  let body: PayBody;
  try {
    body = (await req.json()) as PayBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!body.to || !isAddress(body.to)) {
    return NextResponse.json({ error: "to must be a hex address" }, { status: 400 });
  }
  if (!body.amount_wei) {
    return NextResponse.json({ error: "amount_wei required" }, { status: 400 });
  }
  let amountWei: bigint;
  try {
    amountWei = BigInt(body.amount_wei);
    if (amountWei <= BigInt(0)) throw new Error("must be positive");
  } catch {
    return NextResponse.json(
      { error: "amount_wei must be a positive integer string" },
      { status: 400 },
    );
  }

  if (!user.publicKeyUncompressed) {
    return NextResponse.json(
      { error: "wallet user missing on-chain identity" },
      { status: 500 },
    );
  }

  const result = await executePayment({
    session,
    user: { ...user, publicKeyUncompressed: user.publicKeyUncompressed },
    to: body.to,
    amountWei,
    memo: body.memo ?? null,
    token: body.token,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail, action: result.action },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    tx_hash: result.txHash,
    explorer_url: result.explorerUrl,
    from: result.from,
    to: result.to,
    amount_wei: result.amountWei,
    memo: result.memo,
    token: result.token,
    fee_wei: result.feeWei,
    fee_tx_hash: result.feeTxHash,
    spend_used_wei_after: result.spendUsedWeiAfter,
    spend_cap_wei: result.spendCapWei,
    remaining_wei: result.remainingWei,
    period_end: result.periodEnd,
  });
}
