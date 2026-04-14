import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { readContract } from "viem/actions";
import { tempoClient } from "@/lib/rpc";
import { withReproducibility } from "@/lib/reproducibility";
import { parseAsOfFromRequest, InvalidAsOfError } from "@/lib/as-of";
import { lookupLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ address: string }>;
}

// Minimal ABI fragments — read-only reward precompile functions.
const REWARD_READ_ABI = [
  {
    name: "optedInSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint128" }],
  },
  {
    name: "globalRewardPerToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

// 6-decimal TIP-20 assumption — all deployed Tempo stables use 6 decimals.
const DECIMALS = 1_000_000;

function tokensFromRaw(raw: bigint): number {
  return Number(raw) / DECIMALS;
}

export async function GET(req: Request, { params }: Params) {
  const { address } = await params;
  const stable = address.toLowerCase() as `0x${string}`;

  let asOf: Date | null;
  try {
    asOf = parseAsOfFromRequest(req);
  } catch (e) {
    if (e instanceof InvalidAsOfError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  // As-of timestamp for historical queries; for live, floor to now.
  const effective = asOf ?? new Date();
  const h24 = new Date(effective.getTime() - 24 * 60 * 60 * 1000);
  const d7 = new Date(effective.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    // Sum distributions in three time windows (raw amounts, TIP-20 uint256 stored as numeric).
    const sumsResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN block_timestamp > ${h24} AND block_timestamp <= ${effective} THEN amount ELSE 0 END), 0)::text AS sum_24h,
        COALESCE(SUM(CASE WHEN block_timestamp > ${d7}  AND block_timestamp <= ${effective} THEN amount ELSE 0 END), 0)::text AS sum_7d,
        COALESCE(SUM(CASE WHEN block_timestamp <= ${effective} THEN amount ELSE 0 END), 0)::text AS sum_all_time,
        COUNT(*) FILTER (WHERE block_timestamp <= ${effective})::int AS distribution_count
      FROM reward_distributions
      WHERE stable = ${stable}
    `);
    const sumsRows = ((sumsResult as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (sumsResult as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
    const sums = sumsRows[0] ?? {};
    const sum24hRaw = BigInt((sums.sum_24h as string) ?? "0");
    const sum7dRaw = BigInt((sums.sum_7d as string) ?? "0");
    const sumAllRaw = BigInt((sums.sum_all_time as string) ?? "0");
    const distributionCount = Number(sums.distribution_count ?? 0);

    // Top 5 funders by total contributed (all-time up to asOf).
    const fundersResult = await db.execute(sql`
      SELECT funder, COUNT(*)::int AS distribution_count, COALESCE(SUM(amount), 0)::text AS total_amount
      FROM reward_distributions
      WHERE stable = ${stable} AND block_timestamp <= ${effective}
      GROUP BY funder
      ORDER BY SUM(amount) DESC
      LIMIT 5
    `);
    const fundersRows = ((fundersResult as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (fundersResult as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;

    // Recent 10 distributions (as of asOf).
    const recentResult = await db.execute(sql`
      SELECT funder, amount::text AS amount, block_number, block_timestamp, tx_hash, log_index
      FROM reward_distributions
      WHERE stable = ${stable} AND block_timestamp <= ${effective}
      ORDER BY block_timestamp DESC, log_index DESC
      LIMIT 10
    `);
    const recentRows = ((recentResult as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (recentResult as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;

    // Opt-in stats from decoded events.
    const optInResult = await db.execute(sql`
      SELECT
        COUNT(*)::int AS opt_in_count,
        COUNT(DISTINCT recipient)::int AS distinct_recipients,
        COUNT(*) FILTER (WHERE recipient != holder)::int AS redirected_count
      FROM reward_recipients
      WHERE stable = ${stable}
        AND recipient != '0x0000000000000000000000000000000000000000'
    `);
    const optInRows = ((optInResult as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (optInResult as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
    const optInStats = optInRows[0] ?? {};

    // Live reads — only when NOT doing time-travel (for historical queries, these
    // current values aren't meaningful; omit them).
    let optedInSupply: bigint | null = null;
    let globalRewardPerToken: bigint | null = null;
    let blockNumber: number | null = null;
    if (!asOf) {
      const [optedRes, globalRes, blockRes] = await Promise.allSettled([
        readContract(tempoClient, { address: stable, abi: REWARD_READ_ABI, functionName: "optedInSupply" }),
        readContract(tempoClient, { address: stable, abi: REWARD_READ_ABI, functionName: "globalRewardPerToken" }),
        tempoClient.getBlockNumber(),
      ]);
      if (optedRes.status === "fulfilled") optedInSupply = optedRes.value as bigint;
      if (globalRes.status === "fulfilled") globalRewardPerToken = globalRes.value as bigint;
      if (blockRes.status === "fulfilled") blockNumber = Number(blockRes.value);
    }

    // Effective APY computation — annualize 7d distributed vs opted-in supply.
    // effective_apy = (distributed_7d_tokens / opted_in_tokens) × (365/7)
    let effectiveApyPct: number | null = null;
    if (!asOf && optedInSupply != null && optedInSupply > 0n && sum7dRaw > 0n) {
      const distributed7dTokens = tokensFromRaw(sum7dRaw);
      const optedInTokens = tokensFromRaw(optedInSupply);
      const weeklyRate = distributed7dTokens / optedInTokens;
      effectiveApyPct = weeklyRate * (365 / 7) * 100;
    }

    // Resolve labels for funders.
    const allAddrs = new Set<string>();
    for (const f of fundersRows) allAddrs.add((f.funder as string).toLowerCase());
    for (const r of recentRows) allAddrs.add((r.funder as string).toLowerCase());
    const labels = await lookupLabels([...allAddrs]);

    return withReproducibility(
      NextResponse.json({
        address: stable,
        as_of: asOf?.toISOString() ?? null,
        effective_apy_pct: effectiveApyPct,
        opted_in_supply: optedInSupply != null ? optedInSupply.toString() : null,
        opted_in_tokens: optedInSupply != null ? tokensFromRaw(optedInSupply) : null,
        global_reward_per_token: globalRewardPerToken != null ? globalRewardPerToken.toString() : null,
        distribution_count: distributionCount,
        distributed: {
          last_24h_tokens: tokensFromRaw(sum24hRaw),
          last_7d_tokens: tokensFromRaw(sum7dRaw),
          all_time_tokens: tokensFromRaw(sumAllRaw),
        },
        opt_in: {
          recipient_count: Number(optInStats.opt_in_count ?? 0),
          distinct_recipients: Number(optInStats.distinct_recipients ?? 0),
          redirected_count: Number(optInStats.redirected_count ?? 0),
        },
        top_funders: fundersRows.map((f) => {
          const addr = (f.funder as string).toLowerCase();
          return {
            address: addr,
            label: labels.get(addr) ?? null,
            distribution_count: Number(f.distribution_count),
            total_amount_tokens: tokensFromRaw(BigInt((f.total_amount as string) ?? "0")),
          };
        }),
        recent_distributions: recentRows.map((r) => {
          const addr = (r.funder as string).toLowerCase();
          return {
            funder: addr,
            funder_label: labels.get(addr) ?? null,
            amount_tokens: tokensFromRaw(BigInt((r.amount as string) ?? "0")),
            block_number: Number(r.block_number),
            block_timestamp: r.block_timestamp,
            tx_hash: r.tx_hash,
          };
        }),
      }),
      {
        method: asOf ? "rewards-v1-asof" : "rewards-v1",
        rpcCall: asOf ? undefined : "optedInSupply() + globalRewardPerToken()",
        contracts: [stable],
        tables: ["reward_distributions", "reward_recipients", "events"],
        block: blockNumber ?? undefined,
        freshnessSec: 300,
        asOf,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
