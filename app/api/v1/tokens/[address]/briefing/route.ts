/**
 * GET /api/v1/tokens/[address]/briefing
 *
 * MPP-gated full briefing endpoint.
 *
 * Pipeline:
 *   1. Validate address
 *   2. Check TIP-20 status + pin the measurement block (parallel)
 *   3. Fetch on-chain name/symbol/decimals
 *   4. Run market, compliance, holders, identity in parallel
 *   5. Run safety (needs pools from market) and origin (needs creator from holders) in parallel
 *   6. Build the coverage & provenance ledger (Section 06 — replaces the
 *      retired analyst note)
 *   7. Persist briefing to DB
 *   8. Return full BriefingResult JSON
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getBlockNumber } from "viem/actions";
import { briefingCharge } from "@/lib/mpp/server";
import { tempoClient } from "@/lib/rpc";
import { isTip20, getCompliance } from "@/lib/pipeline/compliance";
import { getMarketData } from "@/lib/pipeline/market";
import { getHoldersWithCache } from "@/lib/pipeline/holders";
import { resolveIdentity } from "@/lib/pipeline/identity";
import { scanSafety } from "@/lib/pipeline/safety";
import { getOrigin } from "@/lib/pipeline/origin";
// Model-based analyst synthesis was removed 2026-04-17 per OLI discipline
// (measurement over inference). Section 06 of the briefing now surfaces the
// coverage & provenance ledger — a product-grade reproducibility receipt —
// instead of a narrative note.
import { db } from "@/lib/db";
import { briefings } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { METHODOLOGY_VERSION } from "@/lib/reproducibility";
import type { BriefingProvenance, BriefingResult } from "@/lib/types";

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
    // 2. Check TIP-20 and pin the measurement block in parallel.  The pinned
    // block becomes part of the briefing's `provenance` so consumers can
    // independently re-verify every on-chain field at the exact block.
    const [tip20, pinnedBlock] = await Promise.all([
      isTip20(checksumAddress),
      getBlockNumber(tempoClient).catch(() => 0n),
    ]);
    const measuredAt = new Date().toISOString();

    let onChainName = "Unknown Token";
    let onChainSymbol = "???";
    let decimals: number | undefined;
    let knownSupply: bigint | undefined;

    if (tip20) {
      // TIP-20: getMetadata returns name, symbol, decimals, totalSupply from the precompile
      const meta = await tempoClient.token
        .getMetadata({ token: checksumAddress })
        .catch(() => null);
      if (meta) {
        onChainName = meta.name ?? onChainName;
        onChainSymbol = meta.symbol ?? onChainSymbol;
        decimals = meta.decimals !== undefined ? Number(meta.decimals) : undefined;
        knownSupply = meta.totalSupply;
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
          coverage: "unavailable" as const,
          coverage_note: err instanceof Error ? err.message.slice(0, 140) : "unknown error",
        };
      }),
      getCompliance(checksumAddress).catch((err) => {
        console.error("[briefing/compliance]", err);
        return {
          token_type: "unknown" as const,
          policy_id: null,
          policy_type: null,
          policy_admin: null,
          paused: null,
          supply_cap: null,
          current_supply: null,
          headroom_pct: null,
          roles: { issuer: [], pause: [], burn_blocked: [] },
          coverage: "unavailable" as const,
          coverage_note: err instanceof Error ? err.message.slice(0, 140) : "unknown error",
        };
      }),
      getHoldersWithCache(checksumAddress, decimals, knownSupply).catch((err) => {
        console.error("[briefing/holders]", err);
        return {
          total_holders: 0,
          top5_pct: 0,
          top10_pct: 0,
          top20_pct: 0,
          creator_address: null,
          creator_hold_pct: null,
          top_holders: [],
          coverage: "unavailable" as const,
          coverage_note: err instanceof Error ? err.message.slice(0, 140) : "unknown error",
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

    // 4. Run safety and origin in parallel (safety needs market.pools +
    // compliance + holders for TIP-20-aware evaluation; origin needs holder
    // creator detection).
    const [safety, origin] = await Promise.all([
      scanSafety(address, tip20, market.pools, compliance, holders).catch((err) => {
        console.error("[briefing/safety]", err);
        return {
          score: 0,
          verdict: "CAUTION" as const,
          flags: ["SAFETY_SCAN_FAILED"],
          warnings: [],
          can_buy: false,
          can_sell: false,
          buy_tax_pct: null,
          sell_tax_pct: null,
          honeypot: false,
        };
      }),
      getOrigin(checksumAddress, holders.creator_address).catch((err) => {
        console.error("[briefing/origin]", err);
        return {
          deployer: null,
          deployer_tx_count: null,
          deployer_age_days: null,
          funding_source: null,
          funding_label: null,
          funding_hops: 0,
          prior_tokens: [],
          coverage: "unavailable" as const,
          coverage_note: err instanceof Error ? err.message.slice(0, 140) : "unknown error",
        };
      }),
    ]);

    // 5. Stablecoin enrichment (only adds value for TIP-20 stables we track).
    // Not surfaced in the response today; retained so downstream consumers
    // can opt into richer stable-specific context without a second round-trip.
    const enrichment = tip20 ? await loadStablecoinEnrichment(address) : null;
    void enrichment;

    // 6. Build the coverage & provenance ledger — the Section 06 product
    // surface that replaces the retired analyst note. Every field is an
    // observation about the measurement run itself; never synthesized.
    const provenance: BriefingProvenance = {
      block_number: pinnedBlock.toString(),
      measured_at: measuredAt,
      methodology_version: METHODOLOGY_VERSION,
      coverage: {
        market: market.coverage,
        // SafetyResult doesn't carry a coverage field today, but the pipeline
        // sets `SAFETY_SCAN_FAILED` on the flags array when the eth_call
        // simulation never returned — surface that as `unavailable` so the
        // Section 06 ledger stays honest.
        safety: safety.flags.includes("SAFETY_SCAN_FAILED") ? "unavailable" : "complete",
        compliance: compliance.coverage,
        holders: holders.coverage,
        origin: origin.coverage,
      },
      sources: {
        market: "GeckoTerminal pool aggregator",
        safety: "tempo eth_call simulation + bytecode scan",
        compliance: tip20
          ? "TIP-20 factory + TIP-403 registry (on-chain reads)"
          : "ERC-20 multicall (name/symbol/decimals)",
        holders: "Transfer event replay",
        identity: "CoinGecko + DefiLlama cross-reference",
        origin: "Transfer event log + deployer tx walk",
      },
    };

    // 7. Persist briefing.  evaluation is null by design (OLI: ship
    // measurements, not LLM inference); provenance is the new ledger.
    const payload: Omit<BriefingResult, "id" | "created_at"> = {
      token_address: address,
      market,
      safety,
      compliance,
      holders,
      identity,
      origin,
      provenance,
      evaluation: null,
    };

    const [row] = await db
      .insert(briefings)
      .values({
        tokenAddress: address,
        payload,
      })
      .returning({ id: briefings.id, createdAt: briefings.createdAt });

    // 8. Return full briefing
    const result: BriefingResult = {
      id: row.id,
      token_address: address,
      market,
      safety,
      compliance,
      holders,
      identity,
      origin,
      provenance,
      evaluation: null,
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
