import { NextResponse } from "next/server";
import { requireSession } from "@/lib/wallet/bearer-auth";
import { quoteSwap, executeSwap } from "@/lib/wallet/execute-swap";
import { rateLimit } from "@/lib/rate-limit";
import { isAddress, parseUnits } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOKEN_DECIMALS = 6;
const DEFAULT_SLIPPAGE_BPS = 100; // 1%

type SwapBody = {
  token_in: `0x${string}`;
  token_out: `0x${string}`;
  amount: string;
  slippage_bps?: number;
  quote_only?: boolean;
};

export async function POST(req: Request) {
  const resolved = await requireSession(req, { requireOnChainAuthorize: true });
  if (resolved instanceof NextResponse) return resolved;
  const { session, user } = resolved;

  const rl = rateLimit(`swap:${user.id}`, { max: 10, windowMs: 60_000 });
  if (!rl.ok) return rl.response;

  let body: SwapBody;
  try {
    body = (await req.json()) as SwapBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!body.token_in || !isAddress(body.token_in)) {
    return NextResponse.json({ error: "token_in must be a hex address" }, { status: 400 });
  }
  if (!body.token_out || !isAddress(body.token_out)) {
    return NextResponse.json({ error: "token_out must be a hex address" }, { status: 400 });
  }
  if (!body.amount) {
    return NextResponse.json({ error: "amount required" }, { status: 400 });
  }

  let amountIn: bigint;
  try {
    amountIn = parseUnits(body.amount, TOKEN_DECIMALS);
    if (amountIn <= BigInt(0)) throw new Error("must be positive");
  } catch {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }

  const quote = await quoteSwap({
    tokenIn: body.token_in,
    tokenOut: body.token_out,
    amountIn,
  });

  if (!quote.ok) {
    return NextResponse.json({ error: quote.error }, { status: quote.status });
  }

  if (body.quote_only) {
    return NextResponse.json({
      ok: true,
      quote_only: true,
      amount_in: body.amount,
      amount_out: quote.amountOutDisplay,
      amount_out_wei: quote.amountOut.toString(),
    });
  }

  const slippageBps = body.slippage_bps ?? DEFAULT_SLIPPAGE_BPS;
  const minAmountOut = quote.amountOut - (quote.amountOut * BigInt(slippageBps)) / BigInt(10_000);

  if (!user.publicKeyUncompressed) {
    return NextResponse.json({ error: "wallet user missing on-chain identity" }, { status: 500 });
  }

  const result = await executeSwap({
    session,
    user: { ...user, publicKeyUncompressed: user.publicKeyUncompressed },
    tokenIn: body.token_in,
    tokenOut: body.token_out,
    amountIn,
    minAmountOut,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    tx_hash: result.txHash,
    explorer_url: result.explorerUrl,
    amount_in: body.amount,
    amount_out: quote.amountOutDisplay,
    token_in: body.token_in,
    token_out: body.token_out,
  });
}
