import { tempoClient } from "@/lib/rpc";
import type { HolderData } from "@/lib/types";
import { TEMPO_ADDRESSES } from "@/lib/types";
import { getBlockNumber } from "viem/actions";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

// Minimal Transfer event ABI — works with any ERC20/TIP20 token
const TRANSFER_ABI = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

// Tempo RPC enforces two limits per eth_getLogs call:
//   1. Max block range: 100,000 blocks
//   2. Max results: 20,000 logs (error: "Request exceeds defined limit")
// Start SMALL enough to avoid the 20k-results cap on most reasonable tokens,
// and adaptively shrink further on either overflow. Hot tokens like USDC.e
// with dense transfer activity needed smaller initial chunks to avoid a
// thundering-herd of bisected retries.
const BLOCK_CHUNK = 2_000n;
const PARALLEL_CHUNKS = 3;

// Default wall-time budget for the entire log enumeration at request time.
// If exceeded, we return coverage:"partial" (or "unavailable" if zero logs
// collected) with whatever we've gathered so far — prevents the briefing
// from eating its entire function budget on a single hot token.
// The background `holder-snapshot` cron overrides this with a much larger
// budget so the cached snapshot can cover hot tokens fully.
const WALL_TIME_BUDGET_MS = 45_000;

// Maximum age of a cached snapshot before we treat it as stale and fall back
// to live enumeration.  Balances freshness against how long a full snapshot
// takes to regenerate — the holder-snapshot cron runs every 30 min so three
// hours gives us 5–6 successful refreshes of headroom before staleness.
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

/** Detect whether an RPC error indicates a limit overflow we can recover from
 * by bisecting the block range. viem nests error details across `cause`,
 * `details`, `shortMessage`, and `message`, so we stringify-and-search all of
 * them rather than guessing the "right" field. */
function isLimitOverflow(err: unknown): boolean {
  const parts: string[] = [];
  const pushIfStr = (v: unknown) => {
    if (typeof v === "string") parts.push(v);
  };
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    pushIfStr(e.message);
    pushIfStr(e.shortMessage);
    pushIfStr(e.details);
    if (e.cause && typeof e.cause === "object") {
      const c = e.cause as Record<string, unknown>;
      pushIfStr(c.message);
      pushIfStr(c.shortMessage);
      pushIfStr(c.details);
    }
  }
  const haystack = parts.join(" | ").toLowerCase();
  return (
    haystack.includes("max block range") ||
    haystack.includes("exceeds defined limit") ||
    haystack.includes("request exceeds") ||
    haystack.includes("too many results") ||
    haystack.includes("limit exceeded") ||
    haystack.includes("exceed")
  );
}

/** Extract the "retry with range X-Y" hint from any string field in the error. */
function extractRetryHint(err: unknown): { to: bigint } | null {
  const parts: string[] = [];
  const pushIfStr = (v: unknown) => {
    if (typeof v === "string") parts.push(v);
  };
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    pushIfStr(e.message);
    pushIfStr(e.details);
    if (e.cause && typeof e.cause === "object") {
      const c = e.cause as Record<string, unknown>;
      pushIfStr(c.message);
      pushIfStr(c.details);
    }
  }
  const haystack = parts.join(" | ");
  const m = /retry with the range (\d+)-(\d+)/i.exec(haystack);
  return m ? { to: BigInt(m[2]) } : null;
}

/** Fetch Transfer events for a single block range, shrinking adaptively if
 * Tempo rejects for either limit. Uses RPC-suggested ranges when available,
 * otherwise bisects. Floor of 1 block prevents infinite recursion. */
async function fetchRange(
  address: `0x${string}`,
  from: bigint,
  to: bigint,
): Promise<Awaited<ReturnType<typeof tempoClient.getContractEvents>>> {
  try {
    return await tempoClient.getContractEvents({
      address,
      abi: TRANSFER_ABI,
      eventName: "Transfer",
      fromBlock: from,
      toBlock: to,
    });
  } catch (err) {
    // Explicit RPC hint — honor it precisely.
    const hint = extractRetryHint(err);
    if (hint) {
      const head = await fetchRange(address, from, hint.to);
      const tail =
        hint.to + 1n <= to ? await fetchRange(address, hint.to + 1n, to) : [];
      return [...head, ...tail];
    }

    // Generic limit overflow (block-range OR result-count) — bisect and retry.
    // Floor at 1-block ranges to prevent infinite recursion on a single hot block.
    if (isLimitOverflow(err) && to > from) {
      const mid = from + (to - from) / 2n;
      const head = await fetchRange(address, from, mid);
      const tail = await fetchRange(address, mid + 1n, to);
      return [...head, ...tail];
    }

    throw err;
  }
}

interface FetchAllResult {
  logs: Awaited<ReturnType<typeof tempoClient.getContractEvents>>;
  /** true if we stopped because we ran out of wall-time budget */
  truncated: boolean;
  rangesProcessed: number;
  rangesTotal: number;
}

/** Paginate across the full chain — parallel at the outer loop, adaptive at
 * each range. Safe for Tempo's 100k-block / 20k-result caps. Enforces a
 * caller-provided wall-time budget so hot tokens can't blow the entire
 * function timeout at request-time, but the background cron can still
 * request a multi-minute budget to fully enumerate hot tokens. */
async function fetchAllTransferLogs(
  address: `0x${string}`,
  budgetMs: number = WALL_TIME_BUDGET_MS,
): Promise<FetchAllResult & { latest: bigint }> {
  const latest = await getBlockNumber(tempoClient);
  const ranges: Array<{ from: bigint; to: bigint }> = [];
  for (let start = 0n; start <= latest; start += BLOCK_CHUNK) {
    const end = start + BLOCK_CHUNK - 1n < latest ? start + BLOCK_CHUNK - 1n : latest;
    ranges.push({ from: start, to: end });
  }

  const startedAt = Date.now();
  const out: Awaited<ReturnType<typeof tempoClient.getContractEvents>> = [];
  let rangesProcessed = 0;
  let truncated = false;

  for (let i = 0; i < ranges.length; i += PARALLEL_CHUNKS) {
    if (Date.now() - startedAt > budgetMs) {
      truncated = true;
      break;
    }
    const batch = ranges.slice(i, i + PARALLEL_CHUNKS);
    const results = await Promise.all(batch.map((r) => fetchRange(address, r.from, r.to)));
    for (const logs of results) out.push(...logs);
    rangesProcessed += batch.length;
  }
  return { logs: out, truncated, rangesProcessed, rangesTotal: ranges.length, latest };
}

// Addresses to exclude from holder lists (burn sinks, not real holders)
const BURN_ADDRESSES = new Set([
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
]);

// Well-known system addresses with labels
const SYSTEM_LABELS: Record<string, string> = {
  "0xdec0000000000000000000000000000000000000": "Enshrined DEX",
  "0xfeec000000000000000000000000000000000000": "Fee Manager",
  "0x0000000000000000000000000000000000000000": "Burn Address",
  "0x000000000000000000000000000000000000dead": "Burn Address",
  // Also label known Tempo system addresses from types.ts
  [TEMPO_ADDRESSES.stablecoinDex.toLowerCase()]: "Enshrined DEX",
  [TEMPO_ADDRESSES.feeManager.toLowerCase()]: "Fee Manager",
};

/** Empty coverage-unavailable result — never pretend "0 holders" when we don't know. */
function unavailable(note: string): HolderData {
  return {
    total_holders: 0,
    top5_pct: 0,
    top10_pct: 0,
    top20_pct: 0,
    creator_address: null,
    creator_hold_pct: null,
    top_holders: [],
    coverage: "unavailable",
    coverage_note: note,
  };
}

/**
 * Scan all Transfer events for a token, reconstruct balances, compute concentration metrics.
 *
 * Strategy:
 * 1. Fetch every Transfer log from block 0 to latest via getContractEvents
 * 2. Replay events to build a balance map (bigint arithmetic, no rounding)
 * 3. Detect creator = first address that received a mint (from == zero address)
 * 4. Strip burn addresses, sort by balance desc, compute top-N percentages
 * 5. Return top 50 holders with human-readable labels for known system addresses
 *
 * Coverage discipline: if log enumeration throws (RPC limits, timeout) OR
 * returns zero logs for a token we know has positive circulating supply, we
 * return coverage: "unavailable" instead of fabricating a "0 holders" answer.
 * The downstream evaluation layer MUST treat unavailable coverage as missing
 * data, not as confirmation of zero holders — this is the OLI measurement-
 * over-inference rule in practice.
 */
export async function getHolders(
  address: `0x${string}`,
  decimals?: number,
  knownSupply?: bigint,
  options?: { budgetMs?: number }
): Promise<HolderData & { asOfBlock?: number }> {
  const budgetMs = options?.budgetMs ?? WALL_TIME_BUDGET_MS;

  // Fetch all Transfer events from genesis to latest (paginated — Tempo RPC
  // rejects >100k block ranges per call). Wall-time budget prevents a single
  // hot token from starving the rest of the briefing pipeline.
  let fetched: FetchAllResult & { latest: bigint };
  try {
    fetched = await fetchAllTransferLogs(address, budgetMs);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return unavailable(`Transfer-event enumeration failed: ${msg.slice(0, 140)}`);
  }
  const logs = fetched.logs;

  // Contradiction check: zero logs for a token with known supply > 0 means
  // enumeration either timed out before finding any, or the Transfer event
  // shape doesn't match. Don't claim zero holders — return unavailable.
  if (logs.length === 0 && knownSupply !== undefined && knownSupply > 0n) {
    const suffix = fetched.truncated
      ? ` Wall-time budget exhausted after processing ${fetched.rangesProcessed}/${fetched.rangesTotal} block ranges.`
      : "";
    return unavailable(
      `No Transfer events returned despite known supply of ${knownSupply.toString()}. RPC enumeration likely failed.${suffix}`
    );
  }

  // Reconstruct balances from transfer events
  const balances = new Map<string, bigint>();
  let creatorAddress: string | null = null;

  // Narrow the log shape — fetchAllTransferLogs returns the viem union type.
  type TransferLog = { args: { from: string; to: string; amount: bigint } };

  for (const log of logs as unknown as TransferLog[]) {
    const { from, to, amount } = log.args;

    const fromNorm = from.toLowerCase();
    const toNorm = to.toLowerCase();

    // Detect first mint: Transfer from zero address identifies the creator (receiver)
    if (
      fromNorm === "0x0000000000000000000000000000000000000000" &&
      creatorAddress === null &&
      !BURN_ADDRESSES.has(toNorm)
    ) {
      creatorAddress = toNorm;
    }

    // Subtract from sender (skip zero address mints)
    if (fromNorm !== "0x0000000000000000000000000000000000000000") {
      const prev = balances.get(fromNorm) ?? 0n;
      balances.set(fromNorm, prev - amount);
    }

    // Add to receiver
    const prev = balances.get(toNorm) ?? 0n;
    balances.set(toNorm, prev + amount);
  }

  // Filter to positive balances, excluding burn addresses
  const holders = Array.from(balances.entries())
    .filter(([addr, bal]) => bal > 0n && !BURN_ADDRESSES.has(addr))
    .sort(([, a], [, b]) => (b > a ? 1 : b < a ? -1 : 0));

  // Compute total supply in circulation (sum of all positive balances, excl. burns)
  const totalSupply = holders.reduce((sum, [, bal]) => sum + bal, 0n);

  // Second contradiction check: logs present but reconstructed supply is zero.
  // If enumeration was truncated by the wall-time budget this just means we
  // didn't scan deep enough — partial, not broken. Otherwise it indicates a
  // Transfer shape we didn't parse (e.g., wrong event sig).
  if (holders.length === 0 && knownSupply !== undefined && knownSupply > 0n) {
    if (fetched.truncated) {
      return unavailable(
        `Wall-time budget exhausted after ${fetched.rangesProcessed}/${fetched.rangesTotal} block ranges; no holder balances reconstructed in that window. Enumeration is infeasible at request-time for this token — recommend caching via background cron.`
      );
    }
    return unavailable(
      `Replayed ${logs.length} Transfer events but reconstructed zero positive balances; Transfer event shape may not match TIP-20 precompile emission.`
    );
  }

  // Compute top 5/10/20 percentages
  const pctOf = (n: number): number => {
    if (totalSupply === 0n) return 0;
    const slice = holders.slice(0, n).reduce((sum, [, bal]) => sum + bal, 0n);
    return Number((slice * 10000n) / totalSupply) / 100;
  };

  const top5_pct = pctOf(5);
  const top10_pct = pctOf(10);
  const top20_pct = pctOf(20);

  // Build top 50 holder list with labels and human-readable balances
  const top_holders = holders.slice(0, 50).map(([addr, bal]) => {
    const pct =
      totalSupply === 0n
        ? 0
        : Number((bal * 10000n) / totalSupply) / 100;

    // Format balance: divide by decimals if provided, otherwise raw
    const balanceFormatted =
      decimals !== undefined
        ? formatDecimals(bal, decimals)
        : bal.toString();

    const label = SYSTEM_LABELS[addr] ?? null;

    return {
      address: addr,
      balance: balanceFormatted,
      pct,
      label,
    };
  });

  // Creator hold percentage
  let creator_hold_pct: number | null = null;
  if (creatorAddress !== null) {
    const creatorBal = balances.get(creatorAddress) ?? 0n;
    if (creatorBal > 0n && totalSupply > 0n) {
      creator_hold_pct = Number((creatorBal * 10000n) / totalSupply) / 100;
    } else {
      creator_hold_pct = 0;
    }
  }

  // Coverage: default to complete, downgrade to partial if (a) we hit the
  // wall-time budget, or (b) reconstructed supply doesn't match known supply
  // within tolerance.
  let coverage: HolderData["coverage"] = "complete";
  let coverage_note: string | null = null;

  if (fetched.truncated) {
    coverage = "partial";
    coverage_note = `Wall-time budget exhausted after processing ${fetched.rangesProcessed}/${fetched.rangesTotal} block ranges (~${Math.round((fetched.rangesProcessed / fetched.rangesTotal) * 100)}% of chain history). Holder counts reflect partial history — treat as lower bound.`;
  } else if (knownSupply !== undefined && knownSupply > 0n) {
    const diff =
      totalSupply > knownSupply ? totalSupply - knownSupply : knownSupply - totalSupply;
    // Allow 1% skew for rounding + pending transfers in the latest block
    const tolerance = knownSupply / 100n;
    if (diff > tolerance) {
      coverage = "partial";
      coverage_note = `Reconstructed supply (${totalSupply.toString()}) diverges from on-chain supply (${knownSupply.toString()}) by more than 1%. Some Transfer events likely missing.`;
    }
  }

  return {
    total_holders: holders.length,
    top5_pct,
    top10_pct,
    top20_pct,
    creator_address: creatorAddress,
    creator_hold_pct,
    top_holders,
    coverage,
    coverage_note,
    asOfBlock: Number(fetched.latest),
  };
}

/** Cache read.  Returns a snapshot written by the `holder-snapshot` cron if
 * one exists and is newer than CACHE_TTL_MS; otherwise null so callers fall
 * back to live enumeration.  Keep this function *read-only* — writes happen
 * exclusively in the cron path via `writeHolderSnapshot` below. */
export async function getCachedHolders(
  address: `0x${string}`
): Promise<HolderData | null> {
  const addr = address.toLowerCase();
  const result = await db.execute(sql`
    SELECT total_holders, top5_pct, top10_pct, top20_pct,
           creator_address, creator_hold_pct, top_holders,
           coverage, coverage_note, computed_at
    FROM holder_snapshots
    WHERE stable = ${addr}
  `);
  const rows = ((result as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (result as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
  const row = rows[0];
  if (!row) return null;

  const computedAt = row.computed_at as string | Date;
  const ageMs = Date.now() - new Date(computedAt).getTime();
  if (ageMs > CACHE_TTL_MS) return null;

  return {
    total_holders: Number(row.total_holders),
    top5_pct: Number(row.top5_pct),
    top10_pct: Number(row.top10_pct),
    top20_pct: Number(row.top20_pct),
    creator_address: (row.creator_address as string | null) ?? null,
    creator_hold_pct:
      row.creator_hold_pct !== null && row.creator_hold_pct !== undefined
        ? Number(row.creator_hold_pct)
        : null,
    top_holders: row.top_holders as HolderData["top_holders"],
    coverage: row.coverage as HolderData["coverage"],
    coverage_note: (row.coverage_note as string | null) ?? null,
  };
}

/** Cache writeback.  Called exclusively from `lib/ingest/holder-snapshot-builder.ts`
 * after a generously-budgeted live enumeration completes.  UPSERTs by stable
 * address so each run replaces the prior snapshot in place. */
export async function writeHolderSnapshot(
  address: `0x${string}`,
  snap: HolderData & { asOfBlock?: number }
): Promise<void> {
  const addr = address.toLowerCase();
  await db.execute(sql`
    INSERT INTO holder_snapshots (
      stable, total_holders, top5_pct, top10_pct, top20_pct,
      creator_address, creator_hold_pct, top_holders,
      coverage, coverage_note, as_of_block, computed_at
    ) VALUES (
      ${addr},
      ${snap.total_holders},
      ${snap.top5_pct},
      ${snap.top10_pct},
      ${snap.top20_pct},
      ${snap.creator_address},
      ${snap.creator_hold_pct},
      ${JSON.stringify(snap.top_holders)}::jsonb,
      ${snap.coverage},
      ${snap.coverage_note ?? null},
      ${snap.asOfBlock ?? null},
      NOW()
    )
    ON CONFLICT (stable) DO UPDATE SET
      total_holders = EXCLUDED.total_holders,
      top5_pct = EXCLUDED.top5_pct,
      top10_pct = EXCLUDED.top10_pct,
      top20_pct = EXCLUDED.top20_pct,
      creator_address = EXCLUDED.creator_address,
      creator_hold_pct = EXCLUDED.creator_hold_pct,
      top_holders = EXCLUDED.top_holders,
      coverage = EXCLUDED.coverage,
      coverage_note = EXCLUDED.coverage_note,
      as_of_block = EXCLUDED.as_of_block,
      computed_at = NOW()
  `);
}

/** Request-time convenience: try the cached snapshot first; fall back to
 * live enumeration with the caller's budget if the cache is cold or stale.
 * Most request-time callers (briefing, /api/v1/tokens) should use THIS
 * instead of `getHolders` directly so hot tokens return a complete snapshot
 * written by the cron rather than a partial live-enumeration result. */
export async function getHoldersWithCache(
  address: `0x${string}`,
  decimals?: number,
  knownSupply?: bigint,
  options?: { budgetMs?: number }
): Promise<HolderData> {
  const cached = await getCachedHolders(address).catch(() => null);
  if (cached) return cached;
  return getHolders(address, decimals, knownSupply, options);
}

/**
 * Format a raw bigint balance to a human-readable string with up to 6 decimal places.
 * e.g. 1_500_000_000_000_000_000n with decimals=18 → "1.5"
 */
function formatDecimals(raw: bigint, decimals: number): string {
  if (decimals === 0) return raw.toString();

  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;

  if (frac === 0n) return whole.toString();

  // Pad fraction to full decimal width, then trim trailing zeros (up to 6 sig frac digits)
  const fracStr = frac.toString().padStart(decimals, "0");
  const trimmed = fracStr.slice(0, 6).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}
