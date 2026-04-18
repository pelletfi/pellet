import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { tempoClient } from "@/lib/rpc";
import { readContract, getBlockNumber } from "viem/actions";
import { KNOWN_STABLECOINS } from "@/lib/pipeline/stablecoins";
import { writeHolderSnapshot } from "@/lib/pipeline/holders";
import type { HolderData } from "@/lib/types";
import { TEMPO_ADDRESSES } from "@/lib/types";

// Balance-affecting event topics on Tempo TIP-20 tokens.  TIP-20 does NOT
// encode mints as Transfer-from-0x0; it emits a dedicated Mint event instead.
// Treating only Transfer events would systematically underreport supply by
// the full issued-but-never-transferred-again fraction of every hot token.
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
// Mint(address indexed to, uint256 value) — TIP-20 precompile emission.
const MINT_TOPIC =
  "0x0f6798a560793a54c3bcfe86a93cde1e73087d944c0ea20544137d4121396885";
// Burn(address indexed from, uint256 value) — TIP-20 precompile emission.
const BURN_TOPIC =
  "0xcc16f5dbb4873280815c1ee09dbd06736cffcc184412cf7a71a0fdb75d397ca5";

// Addresses that hold tokens but aren't meaningful "holders" (burn sinks).
const BURN_ADDRESSES = new Set([
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
]);

// Well-known system addresses with labels — mirrors the request-time list
// in lib/pipeline/holders.ts so the cache returns the same labels consumers
// already expect from a live call.
const SYSTEM_LABELS: Record<string, string> = {
  "0xdec0000000000000000000000000000000000000": "Enshrined DEX",
  "0xfeec000000000000000000000000000000000000": "Fee Manager",
  "0x0000000000000000000000000000000000000000": "Burn Address",
  "0x000000000000000000000000000000000000dead": "Burn Address",
  [TEMPO_ADDRESSES.stablecoinDex.toLowerCase()]: "Enshrined DEX",
  [TEMPO_ADDRESSES.feeManager.toLowerCase()]: "Fee Manager",
};

const TIP20_READ_ABI = [
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

function topicToAddress(topic: string): string {
  return `0x${topic.slice(-40).toLowerCase()}`;
}

function formatDecimals(raw: bigint, decimals: number): string {
  if (decimals === 0) return raw.toString();
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0");
  const trimmed = fracStr.slice(0, 6).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

// ── Incremental balance application ────────────────────────────────────────
//
// The old implementation pulled every Transfer/Mint/Burn event for every
// tracked stablecoin on every cron tick (~100MB/run × 6 runs/hour).  This
// rewrite maintains persistent balances in `holder_balances` and advances a
// per-stable cursor in `ingestion_cursors` (key = `holder-snapshot:{addr}`),
// so each run only pulls events with block_number > cursor.  After the
// one-time bootstrap run, subsequent runs pull only the delta — typically a
// few hundred events per ten minutes of chain activity.

interface EventRow {
  event_type: string;
  args: { topics: string[]; data: string };
  block_number: string | number;
  log_index: number;
}

function cursorKey(addr: string): string {
  return `holder-snapshot:${addr.toLowerCase()}`;
}

async function readCursor(addr: string): Promise<number> {
  const key = cursorKey(addr);
  const result = await db.execute(sql`
    SELECT last_block FROM ingestion_cursors WHERE contract = ${key}
  `);
  const rows = ((result as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (result as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
  return Number(rows[0]?.last_block ?? 0);
}

async function writeCursor(addr: string, block: number): Promise<void> {
  const key = cursorKey(addr);
  await db.execute(sql`
    INSERT INTO ingestion_cursors (contract, last_block)
    VALUES (${key}, ${block})
    ON CONFLICT (contract) DO UPDATE SET
      last_block = EXCLUDED.last_block,
      updated_at = NOW()
  `);
}

/** Read new events since the cursor, apply signed balance deltas to
 * holder_balances, advance the cursor, and return the creator address
 * (derived from the first Mint / Transfer-from-0x0) if observed in this
 * batch — only meaningful on bootstrap, but cheap to return always. */
async function applyDeltas(
  address: `0x${string}`,
): Promise<{ creatorCandidate: string | null; eventsApplied: number; maxBlock: number }> {
  const addr = address.toLowerCase();
  const fromBlock = await readCursor(addr);

  const result = await db.execute(sql`
    SELECT event_type, args, block_number, log_index
    FROM events
    WHERE contract = ${addr}
      AND event_type IN (${TRANSFER_TOPIC}, ${MINT_TOPIC}, ${BURN_TOPIC})
      AND block_number > ${fromBlock}
    ORDER BY block_number ASC, log_index ASC
  `);
  const rows = ((result as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (result as unknown as Record<string, unknown>[])) as unknown as EventRow[];

  if (rows.length === 0) {
    return { creatorCandidate: null, eventsApplied: 0, maxBlock: fromBlock };
  }

  // Coalesce deltas in-memory before UPSERT.  A single cron tick covering N
  // events on K distinct holders is K UPSERTs not N UPSERTs — avoids hammering
  // the table with duplicate writes on hot holders like the DEX pool.
  const deltas = new Map<string, bigint>();
  let creatorCandidate: string | null = null;
  let maxBlock = fromBlock;

  for (const row of rows) {
    const topics = row.args.topics;
    const data = row.args.data;
    const blockNum = Number(row.block_number);
    if (blockNum > maxBlock) maxBlock = blockNum;
    if (!topics) continue;

    let amount: bigint;
    try {
      amount = BigInt(data);
    } catch {
      continue;
    }

    if (row.event_type === MINT_TOPIC) {
      if (topics.length < 2) continue;
      const to = topicToAddress(topics[1]);
      if (creatorCandidate === null && !BURN_ADDRESSES.has(to)) {
        creatorCandidate = to;
      }
      deltas.set(to, (deltas.get(to) ?? 0n) + amount);
    } else if (row.event_type === BURN_TOPIC) {
      if (topics.length < 2) continue;
      const from = topicToAddress(topics[1]);
      deltas.set(from, (deltas.get(from) ?? 0n) - amount);
    } else {
      // Transfer(from, to, amount)
      if (topics.length < 3) continue;
      const from = topicToAddress(topics[1]);
      const to = topicToAddress(topics[2]);
      if (
        from === "0x0000000000000000000000000000000000000000" &&
        creatorCandidate === null &&
        !BURN_ADDRESSES.has(to)
      ) {
        creatorCandidate = to;
      }
      if (from !== "0x0000000000000000000000000000000000000000") {
        deltas.set(from, (deltas.get(from) ?? 0n) - amount);
      }
      deltas.set(to, (deltas.get(to) ?? 0n) + amount);
    }
  }

  // UPSERT one row per holder with the net delta this batch contributed.
  // Batched into a single multi-VALUES statement so we don't round-trip
  // per-holder — critical for bootstrap runs that touch thousands of holders.
  if (deltas.size > 0) {
    const entries = Array.from(deltas.entries());
    // Chunk to stay under Postgres' parameter limit (~65k).  3 params per row
    // × 10k rows = 30k params, comfortably under.
    const CHUNK = 10_000;
    for (let i = 0; i < entries.length; i += CHUNK) {
      const chunk = entries.slice(i, i + CHUNK);
      const valuesSql = sql.join(
        chunk.map(([holder, delta]) =>
          sql`(${addr}, ${holder}, ${delta.toString()}::numeric)`,
        ),
        sql`, `,
      );
      await db.execute(sql`
        INSERT INTO holder_balances (stable, holder, balance)
        VALUES ${valuesSql}
        ON CONFLICT (stable, holder) DO UPDATE SET
          balance = holder_balances.balance + EXCLUDED.balance
      `);
    }
  }

  await writeCursor(addr, maxBlock);
  return { creatorCandidate, eventsApplied: rows.length, maxBlock };
}

// ── Snapshot read ──────────────────────────────────────────────────────────

interface BalanceRow {
  holder: string;
  balance: string;
}

/** Read top-N holders + totals from `holder_balances`.  Small result set —
 * LIMIT 50 for the top holders plus two aggregate rows for counts/totals. */
async function readSnapshotFromBalances(
  address: `0x${string}`,
  decimals?: number,
  knownSupply?: bigint,
  creatorAddress: string | null = null,
  asOfBlock?: number,
): Promise<HolderData & { asOfBlock?: number }> {
  const addr = address.toLowerCase();

  // Build the filter that excludes burn sinks so counts/totals/top-N all
  // agree.  Parameterising the IN list keeps the query plan stable.
  const burnList = sql.join(
    Array.from(BURN_ADDRESSES).map((a) => sql`${a}`),
    sql`, `,
  );

  const [topResult, aggResult] = await Promise.all([
    db.execute(sql`
      SELECT holder, balance::text AS balance
      FROM holder_balances
      WHERE stable = ${addr}
        AND balance > 0
        AND holder NOT IN (${burnList})
      ORDER BY balance DESC
      LIMIT 50
    `),
    db.execute(sql`
      SELECT
        COUNT(*)::int AS holder_count,
        COALESCE(SUM(balance), 0)::text AS total_supply,
        COALESCE(
          (SELECT SUM(balance) FROM holder_balances
            WHERE stable = ${addr} AND balance > 0
              AND holder NOT IN (${burnList})
            ORDER BY balance DESC LIMIT 5),
          0
        )::text AS top5,
        COALESCE(
          (SELECT SUM(balance) FROM holder_balances
            WHERE stable = ${addr} AND balance > 0
              AND holder NOT IN (${burnList})
            ORDER BY balance DESC LIMIT 10),
          0
        )::text AS top10,
        COALESCE(
          (SELECT SUM(balance) FROM holder_balances
            WHERE stable = ${addr} AND balance > 0
              AND holder NOT IN (${burnList})
            ORDER BY balance DESC LIMIT 20),
          0
        )::text AS top20
      FROM holder_balances
      WHERE stable = ${addr} AND balance > 0
        AND holder NOT IN (${burnList})
    `),
  ]);

  const topRows = ((topResult as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (topResult as unknown as Record<string, unknown>[])) as unknown as BalanceRow[];
  const aggRows = ((aggResult as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (aggResult as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
  const agg = aggRows[0];

  const holderCount = Number(agg?.holder_count ?? 0);
  const totalSupply = BigInt(String(agg?.total_supply ?? "0"));
  const top5Sum = BigInt(String(agg?.top5 ?? "0"));
  const top10Sum = BigInt(String(agg?.top10 ?? "0"));
  const top20Sum = BigInt(String(agg?.top20 ?? "0"));

  // Zero rows with known supply = indexer gap.  Mirror the live-path
  // "unavailable" semantics — OLI: never claim a measurement we didn't make.
  if (holderCount === 0 && knownSupply !== undefined && knownSupply > 0n) {
    return {
      total_holders: 0,
      top5_pct: 0,
      top10_pct: 0,
      top20_pct: 0,
      creator_address: creatorAddress,
      creator_hold_pct: null,
      top_holders: [],
      coverage: "unavailable",
      coverage_note: `No holder balances for ${addr} despite known supply of ${knownSupply.toString()}. Bootstrap may still be in progress or ingest cursor is lagging.`,
    };
  }

  const pctOf = (slice: bigint): number => {
    if (totalSupply === 0n) return 0;
    return Number((slice * 10000n) / totalSupply) / 100;
  };

  const top_holders = topRows.map((r) => {
    const bal = BigInt(r.balance);
    const pct = totalSupply === 0n ? 0 : Number((bal * 10000n) / totalSupply) / 100;
    return {
      address: r.holder,
      balance: decimals !== undefined ? formatDecimals(bal, decimals) : bal.toString(),
      pct,
      label: SYSTEM_LABELS[r.holder] ?? null,
    };
  });

  let creator_hold_pct: number | null = null;
  if (creatorAddress !== null) {
    // creator balance lookup — single row, cheap.
    const creatorResult = await db.execute(sql`
      SELECT balance::text AS balance FROM holder_balances
      WHERE stable = ${addr} AND holder = ${creatorAddress.toLowerCase()}
    `);
    const creatorRows = ((creatorResult as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (creatorResult as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
    const creatorBal = BigInt(String(creatorRows[0]?.balance ?? "0"));
    if (creatorBal > 0n && totalSupply > 0n) {
      creator_hold_pct = Number((creatorBal * 10000n) / totalSupply) / 100;
    } else {
      creator_hold_pct = 0;
    }
  }

  // Coverage: complete unless reconstructed supply diverges from the on-chain
  // total by more than 1% (accounts for rounding + any transfers in the very
  // latest block not yet indexed).
  let coverage: HolderData["coverage"] = "complete";
  let coverage_note: string | null = null;
  if (knownSupply !== undefined && knownSupply > 0n) {
    const diff = totalSupply > knownSupply ? totalSupply - knownSupply : knownSupply - totalSupply;
    const tolerance = knownSupply / 100n;
    if (diff > tolerance) {
      coverage = "partial";
      coverage_note = `Reconstructed supply (${totalSupply.toString()}) diverges from on-chain totalSupply (${knownSupply.toString()}) by > 1%. Ingest cursor may be lagging or some Transfer shape is unparsed.`;
    }
  }

  return {
    total_holders: holderCount,
    top5_pct: pctOf(top5Sum),
    top10_pct: pctOf(top10Sum),
    top20_pct: pctOf(top20Sum),
    creator_address: creatorAddress,
    creator_hold_pct,
    top_holders,
    coverage,
    coverage_note,
    asOfBlock,
  };
}

async function getSupplyAndDecimals(address: `0x${string}`): Promise<{
  supply?: bigint;
  decimals?: number;
}> {
  const [supply, decimals] = await Promise.allSettled([
    readContract(tempoClient, {
      address,
      abi: TIP20_READ_ABI,
      functionName: "totalSupply",
    }),
    readContract(tempoClient, {
      address,
      abi: TIP20_READ_ABI,
      functionName: "decimals",
    }),
  ]);
  return {
    supply: supply.status === "fulfilled" ? (supply.value as bigint) : undefined,
    decimals:
      decimals.status === "fulfilled" ? Number(decimals.value) : undefined,
  };
}

export interface BuildResult {
  stablesProcessed: number;
  stablesWithCompleteCoverage: number;
  stablesWithPartialCoverage: number;
  stablesWithUnavailableCoverage: number;
  eventsApplied: number;
  totalElapsedMs: number;
}

/** Refresh every tracked stablecoin's holder snapshot by advancing its
 * per-stable cursor, applying deltas to `holder_balances`, then reading
 * the top-N from the balances table.  Bandwidth per run after bootstrap
 * is O(new events) + O(top-50), not O(full history). */
export async function refreshHolderSnapshots(): Promise<BuildResult> {
  const startedAt = Date.now();

  let asOfBlock: number | undefined;
  try {
    asOfBlock = Number(await getBlockNumber(tempoClient));
  } catch {
    /* leave undefined */
  }

  let complete = 0;
  let partial = 0;
  let unavailable = 0;
  let eventsApplied = 0;

  for (const stable of KNOWN_STABLECOINS) {
    try {
      // Preserve creator from any prior snapshot — it's immutable once set
      // (creator is the first Mint recipient / first Transfer-from-0x0).
      // If this is the bootstrap run, applyDeltas will derive it.
      const prevResult = await db.execute(sql`
        SELECT creator_address FROM holder_snapshots
        WHERE stable = ${stable.address.toLowerCase()}
      `);
      const prevRows = ((prevResult as unknown as { rows?: Record<string, unknown>[] }).rows
        ?? (prevResult as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
      const prevCreator = (prevRows[0]?.creator_address as string | null) ?? null;

      const { creatorCandidate, eventsApplied: applied } = await applyDeltas(stable.address);
      eventsApplied += applied;

      const creator = prevCreator ?? creatorCandidate;

      const { supply, decimals } = await getSupplyAndDecimals(stable.address);
      const snapshot = await readSnapshotFromBalances(
        stable.address,
        decimals,
        supply,
        creator,
        asOfBlock,
      );
      await writeHolderSnapshot(stable.address, snapshot);

      if (snapshot.coverage === "complete") complete += 1;
      else if (snapshot.coverage === "partial") partial += 1;
      else unavailable += 1;
    } catch (err) {
      console.error(
        `[holder-snapshot] failed for ${stable.symbol} (${stable.address}):`,
        err instanceof Error ? err.message : err,
      );
      unavailable += 1;
    }
  }

  return {
    stablesProcessed: KNOWN_STABLECOINS.length,
    stablesWithCompleteCoverage: complete,
    stablesWithPartialCoverage: partial,
    stablesWithUnavailableCoverage: unavailable,
    eventsApplied,
    totalElapsedMs: Date.now() - startedAt,
  };
}
