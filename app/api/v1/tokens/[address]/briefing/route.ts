/**
 * GET /api/v1/tokens/[address]/briefing
 *
 * MPP-gated full briefing endpoint — $0.05 pathUSD per call.
 *
 * Pipeline:
 *   1. Validate address
 *   2. Check TIP-20 status + fetch on-chain name/symbol
 *   3. Run market, compliance, holders, identity in parallel
 *   4. Run safety (needs pools from market) and origin (needs creator from holders) in parallel
 *   5. Run Claude evaluation with all data
 *   6. Persist briefing to DB
 *   7. Return full BriefingResult JSON
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { briefingCharge } from "@/lib/mpp/server";
import { tempoClient } from "@/lib/rpc";
import { isTip20, getCompliance } from "@/lib/pipeline/compliance";
import { getMarketData } from "@/lib/pipeline/market";
import { getHolders } from "@/lib/pipeline/holders";
import { resolveIdentity } from "@/lib/pipeline/identity";
import { scanSafety } from "@/lib/pipeline/safety";
import { getOrigin } from "@/lib/pipeline/origin";
import { evaluate } from "@/lib/pipeline/evaluation";
import { db } from "@/lib/db";
import { briefings } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import type { BriefingResult } from "@/lib/types";

// ── Stablecoin enrichment for the briefing prompt ───────────────────────────
async function loadStablecoinEnrichment(address: string) {
  const stable = address.toLowerCase();
  try {
    const [pegRows, riskRows, reserveRows, breakRows] = await Promise.all([
      db.execute(sql`
        SELECT window_label, mean_price::float8 AS mean_price,
               stddev_price::float8 AS stddev_price,
               max_deviation_bps::float8 AS max_deviation_bps,
               seconds_outside_10bps
        FROM peg_aggregates WHERE stable = ${stable}
        ORDER BY CASE window_label WHEN '1h' THEN 1 WHEN '24h' THEN 2 WHEN '7d' THEN 3 END
      `),
      db.execute(sql`
        SELECT composite::float8 AS composite, components
        FROM risk_scores WHERE stable = ${stable} LIMIT 1
      `),
      db.execute(sql`
        SELECT reserve_type, backing_usd::float8 AS backing_usd, attestation_source, notes
        FROM reserves WHERE stable = ${stable}
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS c FROM peg_events
        WHERE stable = ${stable} AND started_at >= NOW() - INTERVAL '7 days'
      `),
    ]);
    const peg = (((pegRows as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (pegRows as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>).map((r) => ({
        window: String(r.window_label),
        mean_price: Number(r.mean_price),
        stddev_price: Number(r.stddev_price),
        max_deviation_bps: Number(r.max_deviation_bps),
        seconds_outside_10bps: Number(r.seconds_outside_10bps),
      }));
    const riskArr = ((riskRows as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (riskRows as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
    const risk = riskArr[0]
      ? {
          composite: Number(riskArr[0].composite),
          components: riskArr[0].components as Record<string, number>,
        }
      : null;
    const reserveEntries = (((reserveRows as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (reserveRows as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>).map((r) => ({
        reserve_type: String(r.reserve_type),
        backing_usd: r.backing_usd != null ? Number(r.backing_usd) : null,
        attestation_source: r.attestation_source as string | null,
        notes: r.notes as { issuer?: string; backing_model?: string } | null,
      }));
    const total = reserveEntries.reduce((s, e) => s + (e.backing_usd ?? 0), 0);
    const reserves = reserveEntries.length > 0
      ? { total_backing_usd: total || null, entries: reserveEntries }
      : null;
    const breaksArr = ((breakRows as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (breakRows as unknown as Record<string, unknown>[])) as Array<{ c: number }>;
    return { peg, risk, reserves, recentPegBreaks: breaksArr[0]?.c ?? 0 };
  } catch (e) {
    console.error("[briefing/stable enrichment]", e);
    return { peg: null, risk: null, reserves: null, recentPegBreaks: null };
  }
}

// Minimal ERC-20 ABI for name/symbol reads on non-TIP-20 tokens
const ERC20_META_ABI = [
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

// ── Handler ────────────────────────────────────────────────────────────────────

async function handler(
  _request: NextRequest,
  context: { params: Promise<Record<string, string>> }
): Promise<Response> {
  const { address: rawAddress } = await context.params;
  const address = rawAddress?.toLowerCase() ?? "";

  // 1. Validate address format
  if (!address || !isAddress(address)) {
    return NextResponse.json(
      { error: { code: "INVALID_ADDRESS", message: "Invalid token address" } },
      { status: 400 }
    );
  }

  const checksumAddress = address as `0x${string}`;

  try {
    // 2. Check TIP-20 and fetch on-chain name/symbol + decimals
    const tip20 = await isTip20(checksumAddress);

    let onChainName = "Unknown Token";
    let onChainSymbol = "???";
    let decimals: number | undefined;

    if (tip20) {
      // TIP-20: getMetadata returns name, symbol, decimals from the precompile
      const meta = await tempoClient.token
        .getMetadata({ token: checksumAddress })
        .catch(() => null);
      if (meta) {
        onChainName = meta.name ?? onChainName;
        onChainSymbol = meta.symbol ?? onChainSymbol;
        decimals = meta.decimals !== undefined ? Number(meta.decimals) : undefined;
      }
    } else {
      // ERC-20: multicall name + symbol + decimals
      const results = await tempoClient
        .multicall({
          contracts: [
            { address: checksumAddress, abi: ERC20_META_ABI, functionName: "name" },
            { address: checksumAddress, abi: ERC20_META_ABI, functionName: "symbol" },
            { address: checksumAddress, abi: ERC20_META_ABI, functionName: "decimals" },
          ],
          allowFailure: true,
        })
        .catch(() => [
          { status: "failure" as const, error: null, result: undefined },
          { status: "failure" as const, error: null, result: undefined },
          { status: "failure" as const, error: null, result: undefined },
        ]);

      if (results[0].status === "success") onChainName = results[0].result as string;
      if (results[1].status === "success") onChainSymbol = results[1].result as string;
      if (results[2].status === "success") decimals = Number(results[2].result);
    }

    // 3. Run market, compliance, holders, identity in parallel
    const [market, compliance, holders, identity] = await Promise.all([
      getMarketData(address).catch((err) => {
        console.error("[briefing/market]", err);
        return {
          price_usd: 0,
          volume_24h: 0,
          liquidity_usd: 0,
          fdv_usd: null,
          price_change_24h: null,
          pools: [],
        };
      }),
      getCompliance(checksumAddress).catch((err) => {
        console.error("[briefing/compliance]", err);
        return {
          token_type: "erc20" as const,
          policy_id: null,
          policy_type: null,
          policy_admin: null,
          paused: false,
          supply_cap: null,
          current_supply: "0",
          headroom_pct: null,
          roles: { issuer: [], pause: [], burn_blocked: [] },
        };
      }),
      getHolders(checksumAddress, decimals).catch((err) => {
        console.error("[briefing/holders]", err);
        return {
          total_holders: 0,
          top5_pct: 0,
          top10_pct: 0,
          top20_pct: 0,
          creator_address: null,
          creator_hold_pct: null,
          top_holders: [],
        };
      }),
      resolveIdentity(address, onChainName, onChainSymbol).catch((err) => {
        console.error("[briefing/identity]", err);
        return {
          name: onChainName,
          symbol: onChainSymbol,
          description: null,
          image_url: null,
          coingecko_id: null,
          defi_llama_protocol: null,
          links: {},
        };
      }),
    ]);

    // Prefer identity-resolved name/symbol for downstream (evaluation prompt)
    const resolvedName = identity.name ?? onChainName;
    const resolvedSymbol = identity.symbol ?? onChainSymbol;

    // 4. Run safety and origin in parallel (depend on market.pools and holders.creator)
    const [safety, origin] = await Promise.all([
      scanSafety(address, tip20, market.pools).catch((err) => {
        console.error("[briefing/safety]", err);
        return {
          score: 0,
          verdict: "CAUTION" as const,
          flags: ["SAFETY_SCAN_FAILED"],
          warnings: [],
          can_buy: false,
          can_sell: false,
          buy_tax_pct: 0,
          sell_tax_pct: 0,
          honeypot: false,
        };
      }),
      getOrigin(checksumAddress, holders.creator_address).catch((err) => {
        console.error("[briefing/origin]", err);
        return {
          deployer: "unknown",
          deployer_tx_count: 0,
          deployer_age_days: 0,
          funding_source: null,
          funding_label: null,
          funding_hops: 0,
          prior_tokens: [],
        };
      }),
    ]);

    // 5. Stablecoin enrichment (only adds value for TIP-20 stables we track)
    const enrichment = tip20 ? await loadStablecoinEnrichment(address) : null;

    // 6. Claude evaluation
    const evaluation = await evaluate({
      address,
      name: resolvedName,
      symbol: resolvedSymbol,
      market,
      safety,
      compliance,
      holders,
      identity,
      origin,
      pegStats: enrichment?.peg ?? null,
      risk: enrichment?.risk ?? null,
      reserves: enrichment?.reserves ?? null,
      recentPegBreaks: enrichment?.recentPegBreaks ?? null,
    }).catch((err) => {
      console.error("[briefing/evaluation]", err);
      return "Evaluation unavailable due to an error.";
    });

    // 6. Persist briefing to the database
    const payload: Omit<BriefingResult, "id" | "created_at"> = {
      token_address: address,
      market,
      safety,
      compliance,
      holders,
      identity,
      origin,
      evaluation,
    };

    const [row] = await db
      .insert(briefings)
      .values({
        tokenAddress: address,
        payload,
      })
      .returning({ id: briefings.id, createdAt: briefings.createdAt });

    // 7. Return full briefing
    const result: BriefingResult = {
      id: row.id,
      token_address: address,
      market,
      safety,
      compliance,
      holders,
      identity,
      origin,
      evaluation,
      created_at: row.createdAt.toISOString(),
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/v1/tokens/[address]/briefing]", err);
    return NextResponse.json(
      {
        error: {
          code: "BRIEFING_FAILED",
          message: "Failed to generate briefing. Please try again.",
        },
      },
      { status: 500 }
    );
  }
}

// Export the MPP-gated handler
export const GET = briefingCharge(handler);
