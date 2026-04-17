import { NextRequest, NextResponse } from "next/server";
import { isTip20, getCompliance } from "@/lib/pipeline/compliance";
import { getMarketData } from "@/lib/pipeline/market";
import { getHoldersWithCache } from "@/lib/pipeline/holders";
import { scanSafety } from "@/lib/pipeline/safety";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!ADDRESS_RE.test(address)) {
    return NextResponse.json(
      { error: { code: "INVALID_ADDRESS", message: "Address must be a 42-character 0x hex string" } },
      { status: 400 }
    );
  }

  const addr = address.toLowerCase() as `0x${string}`;

  try {
    // Core data — must succeed. These are cheap RPC reads.
    const [tip20, compliance, market] = await Promise.all([
      isTip20(addr),
      getCompliance(addr),
      getMarketData(addr),
    ]);

    // Holders is expensive for hot tokens (full Transfer-log replay) and can
    // legitimately take minutes on heavily-used stables. Degrade gracefully:
    // bound wall time with a timeout and return null if it blows past budget.
    const timeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
      Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);

    // scanSafety needs compliance (for TIP-20 pause/policy) and holders (for
    // picking a realistic `from` in ERC-20 transfer simulation). Safety runs
    // in parallel with holders here, so we pass an empty HolderData stub —
    // scanSafety falls back to a non-zero default `from` when top_holders is
    // empty. TIP-20 path doesn't touch holders at all.
    const emptyHolders = {
      total_holders: 0,
      top5_pct: 0,
      top10_pct: 0,
      top20_pct: 0,
      creator_address: null,
      creator_hold_pct: null,
      top_holders: [],
      coverage: "unavailable" as const,
      coverage_note: "Running in parallel with holder enumeration",
    };

    const [holdersRes, safetyRes] = await Promise.allSettled([
      timeout(getHoldersWithCache(addr), 8_000),
      timeout(scanSafety(addr, tip20, market.pools, compliance, emptyHolders), 8_000),
    ]);

    const holders = holdersRes.status === "fulfilled" ? holdersRes.value : null;
    const safety = safetyRes.status === "fulfilled" ? safetyRes.value : null;

    if (holdersRes.status === "rejected") {
      console.warn(
        `[GET /api/v1/tokens/${address}] holders unavailable:`,
        holdersRes.reason instanceof Error ? holdersRes.reason.message : holdersRes.reason,
      );
    }
    if (safetyRes.status === "rejected") {
      console.warn(
        `[GET /api/v1/tokens/${address}] safety unavailable:`,
        safetyRes.reason instanceof Error ? safetyRes.reason.message : safetyRes.reason,
      );
    }

    return NextResponse.json({
      address: addr,
      token_type: compliance.token_type,
      market: {
        price_usd: market.price_usd,
        volume_24h: market.volume_24h,
        liquidity_usd: market.liquidity_usd,
        fdv_usd: market.fdv_usd,
        price_change_24h: market.price_change_24h,
        pool_count: market.pools.length,
      },
      safety: safety
        ? {
            score: safety.score,
            verdict: safety.verdict,
            flags: safety.flags,
            warnings: safety.warnings,
            can_buy: safety.can_buy,
            can_sell: safety.can_sell,
            honeypot: safety.honeypot,
          }
        : null,
      compliance: {
        policy_type: compliance.policy_type,
        paused: compliance.paused,
        supply_cap: compliance.supply_cap,
        headroom_pct: compliance.headroom_pct,
      },
      holders: holders
        ? {
            total: holders.total_holders,
            top5_pct: holders.top5_pct,
            top10_pct: holders.top10_pct,
            creator: holders.creator_address,
          }
        : null,
    });
  } catch (err) {
    console.error(`[GET /api/v1/tokens/${address}]`, err);
    return NextResponse.json(
      { error: { code: "ENRICHMENT_FAILED", message: "Failed to aggregate token data" } },
      { status: 502 }
    );
  }
}
