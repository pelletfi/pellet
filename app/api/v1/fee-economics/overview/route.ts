import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { withReproducibility } from "@/lib/reproducibility";
import { parseAsOfFromRequest, InvalidAsOfError } from "@/lib/as-of";
import { KNOWN_STABLECOINS } from "@/lib/pipeline/stablecoins";
import { lookupLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

// All deployed Tempo TIP-20 stables use 6 decimals.
const DECIMALS = 1_000_000;

function tokensFromRaw(raw: bigint): number {
  return Number(raw) / DECIMALS;
}

export async function GET(req: Request) {
  let asOf: Date | null;
  try {
    asOf = parseAsOfFromRequest(req);
  } catch (e) {
    if (e instanceof InvalidAsOfError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  const effective = asOf ?? new Date();
  const h24 = new Date(effective.getTime() - 24 * 60 * 60 * 1000);
  const d7 = new Date(effective.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    // Per-stable fee distribution totals (by token column).
    const distrResult = await db.execute(sql`
      SELECT
        token,
        COALESCE(SUM(CASE WHEN block_timestamp > ${h24} AND block_timestamp <= ${effective} THEN amount ELSE 0 END), 0)::text AS sum_24h,
        COALESCE(SUM(CASE WHEN block_timestamp > ${d7}  AND block_timestamp <= ${effective} THEN amount ELSE 0 END), 0)::text AS sum_7d,
        COALESCE(SUM(CASE WHEN block_timestamp <= ${effective} THEN amount ELSE 0 END), 0)::text AS sum_all,
        COUNT(*) FILTER (WHERE block_timestamp <= ${effective})::int AS distribution_count
      FROM fee_distributions
      GROUP BY token
    `);
    const distrRows = ((distrResult as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (distrResult as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
    const byTokenDistr = new Map<string, { sum24h: bigint; sum7d: bigint; sumAll: bigint; count: number }>();
    for (const r of distrRows) {
      byTokenDistr.set((r.token as string).toLowerCase(), {
        sum24h: BigInt((r.sum_24h as string) ?? "0"),
        sum7d: BigInt((r.sum_7d as string) ?? "0"),
        sumAll: BigInt((r.sum_all as string) ?? "0"),
        count: Number(r.distribution_count ?? 0),
      });
    }

    // Per-token user election counts.
    const userPrefResult = await db.execute(sql`
      SELECT token, COUNT(*)::int AS n
      FROM fee_token_users
      WHERE token != '0x0000000000000000000000000000000000000000'
      GROUP BY token
    `);
    const userPrefRows = ((userPrefResult as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (userPrefResult as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
    const usersByToken = new Map<string, number>();
    for (const r of userPrefRows) usersByToken.set((r.token as string).toLowerCase(), Number(r.n));

    // Per-token validator election counts.
    const valPrefResult = await db.execute(sql`
      SELECT token, COUNT(*)::int AS n
      FROM fee_token_validators
      WHERE token != '0x0000000000000000000000000000000000000000'
      GROUP BY token
    `);
    const valPrefRows = ((valPrefResult as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (valPrefResult as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
    const validatorsByToken = new Map<string, number>();
    for (const r of valPrefRows) validatorsByToken.set((r.token as string).toLowerCase(), Number(r.n));

    // Recent 10 distributions across all tokens (for activity signal).
    const recentResult = await db.execute(sql`
      SELECT validator, token, amount::text AS amount, block_number, block_timestamp, tx_hash
      FROM fee_distributions
      WHERE block_timestamp <= ${effective}
      ORDER BY block_timestamp DESC, log_index DESC
      LIMIT 10
    `);
    const recentRows = ((recentResult as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (recentResult as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;

    // Global totals (ecosystem-wide).
    let totalUsers = 0;
    let totalValidators = 0;
    let totalFees7d = 0n;
    for (const v of usersByToken.values()) totalUsers += v;
    for (const v of validatorsByToken.values()) totalValidators += v;
    for (const { sum7d } of byTokenDistr.values()) totalFees7d += sum7d;

    // Build per-stable rows. Use KNOWN_STABLECOINS as the canonical list.
    const stableRows = KNOWN_STABLECOINS.map((s) => {
      const addr = s.address.toLowerCase();
      const distr = byTokenDistr.get(addr) ?? { sum24h: 0n, sum7d: 0n, sumAll: 0n, count: 0 };
      return {
        address: s.address,
        symbol: s.symbol,
        name: s.name,
        users_electing: usersByToken.get(addr) ?? 0,
        validators_electing: validatorsByToken.get(addr) ?? 0,
        fees_received_24h_tokens: tokensFromRaw(distr.sum24h),
        fees_received_7d_tokens: tokensFromRaw(distr.sum7d),
        fees_received_all_time_tokens: tokensFromRaw(distr.sumAll),
        share_of_fees_7d_pct:
          totalFees7d > 0n
            ? Number((distr.sum7d * 10000n) / totalFees7d) / 100
            : null,
        distribution_count: distr.count,
      };
    }).sort((a, b) => b.fees_received_7d_tokens - a.fees_received_7d_tokens);

    // Resolve labels for validators shown in recent distributions.
    const validatorAddrs = new Set<string>();
    for (const r of recentRows) validatorAddrs.add((r.validator as string).toLowerCase());
    const labels = await lookupLabels([...validatorAddrs]);

    // Index KNOWN_STABLECOINS by address for looking up token symbol in recent distributions.
    const symbolByAddr = new Map<string, string>();
    for (const s of KNOWN_STABLECOINS) symbolByAddr.set(s.address.toLowerCase(), s.symbol);

    return withReproducibility(
      NextResponse.json({
        as_of: asOf?.toISOString() ?? null,
        totals: {
          users_electing: totalUsers,
          validators_electing: totalValidators,
          fees_distributed_7d_tokens: tokensFromRaw(totalFees7d),
          fees_distributed_all_time_tokens: tokensFromRaw(
            [...byTokenDistr.values()].reduce((acc, v) => acc + v.sumAll, 0n),
          ),
          distribution_count: [...byTokenDistr.values()].reduce((acc, v) => acc + v.count, 0),
        },
        stablecoins: stableRows,
        recent_distributions: recentRows.map((r) => {
          const vAddr = (r.validator as string).toLowerCase();
          const tAddr = (r.token as string).toLowerCase();
          return {
            validator: vAddr,
            validator_label: labels.get(vAddr) ?? null,
            token: tAddr,
            token_symbol: symbolByAddr.get(tAddr) ?? null,
            amount_tokens: tokensFromRaw(BigInt((r.amount as string) ?? "0")),
            block_number: Number(r.block_number),
            block_timestamp: r.block_timestamp,
            tx_hash: r.tx_hash,
          };
        }),
      }),
      {
        method: asOf ? "fee-economics-v1-asof" : "fee-economics-v1",
        contracts: ["0xfeec000000000000000000000000000000000000"],
        tables: ["fee_distributions", "fee_token_users", "fee_token_validators", "events"],
        freshnessSec: 300,
        asOf,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
