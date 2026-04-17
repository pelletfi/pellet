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

interface TransferRow {
  block_number: string | number;
  log_index: number;
  args: { topics: string[]; data: string };
}

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

/** Reconstruct the current holder set from every Transfer event already
 * indexed in the `events` table.  This bypasses the request-time RPC
 * enumeration entirely — the ingest cron has populated ~300k Transfer logs
 * across all tracked stablecoins, so the replay is ~100ms of DB + in-memory
 * math even for the hottest tokens. */
async function snapshotHoldersFromEvents(
  address: `0x${string}`,
  decimals?: number,
  knownSupply?: bigint,
  asOfBlock?: number,
): Promise<HolderData & { asOfBlock?: number }> {
  const addr = address.toLowerCase();

  const result = await db.execute(sql`
    SELECT event_type, args, block_number, log_index
    FROM events
    WHERE contract = ${addr}
      AND event_type IN (${TRANSFER_TOPIC}, ${MINT_TOPIC}, ${BURN_TOPIC})
    ORDER BY block_number ASC, log_index ASC
  `);
  const rows = ((result as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (result as unknown as Record<string, unknown>[])) as unknown as (TransferRow & { event_type: string })[];

  // Zero balance-affecting events with known positive supply = indexer gap.
  // Mirror the live-path "unavailable" semantics instead of pretending zero
  // holders — OLI: never claim a measurement we didn't make.
  if (rows.length === 0 && knownSupply !== undefined && knownSupply > 0n) {
    return {
      total_holders: 0,
      top5_pct: 0,
      top10_pct: 0,
      top20_pct: 0,
      creator_address: null,
      creator_hold_pct: null,
      top_holders: [],
      coverage: "unavailable",
      coverage_note: `No Transfer / Mint / Burn events for ${addr} in events table despite known supply of ${knownSupply.toString()}. Ingest cron cursor may not have reached this token's genesis yet.`,
    };
  }

  const balances = new Map<string, bigint>();
  let creatorAddress: string | null = null;

  for (const row of rows) {
    const topics = row.args.topics;
    const data = row.args.data;
    if (!topics) continue;
    let amount: bigint;
    try {
      amount = BigInt(data);
    } catch {
      continue;
    }

    if (row.event_type === MINT_TOPIC) {
      // Mint(address indexed to, uint256 value) — topic[1] = recipient.
      if (topics.length < 2) continue;
      const to = topicToAddress(topics[1]);
      if (creatorAddress === null && !BURN_ADDRESSES.has(to)) {
        creatorAddress = to;
      }
      balances.set(to, (balances.get(to) ?? 0n) + amount);
    } else if (row.event_type === BURN_TOPIC) {
      // Burn(address indexed from, uint256 value) — topic[1] = sender.
      if (topics.length < 2) continue;
      const from = topicToAddress(topics[1]);
      balances.set(from, (balances.get(from) ?? 0n) - amount);
    } else {
      // Transfer(address indexed from, address indexed to, uint256 value).
      if (topics.length < 3) continue;
      const from = topicToAddress(topics[1]);
      const to = topicToAddress(topics[2]);
      // Treat Transfer-from-0x0 as a mint-fallback for any ERC-20 style
      // contracts (belt + braces — TIP-20 won't emit these, but standard
      // ERC-20s absolutely do).
      if (
        from === "0x0000000000000000000000000000000000000000" &&
        creatorAddress === null &&
        !BURN_ADDRESSES.has(to)
      ) {
        creatorAddress = to;
      }
      if (from !== "0x0000000000000000000000000000000000000000") {
        balances.set(from, (balances.get(from) ?? 0n) - amount);
      }
      balances.set(to, (balances.get(to) ?? 0n) + amount);
    }
  }

  const holders = Array.from(balances.entries())
    .filter(([a, b]) => b > 0n && !BURN_ADDRESSES.has(a))
    .sort(([, a], [, b]) => (b > a ? 1 : b < a ? -1 : 0));

  const totalSupply = holders.reduce((sum, [, bal]) => sum + bal, 0n);

  const pctOf = (n: number): number => {
    if (totalSupply === 0n) return 0;
    const slice = holders.slice(0, n).reduce((sum, [, bal]) => sum + bal, 0n);
    return Number((slice * 10000n) / totalSupply) / 100;
  };

  const top_holders = holders.slice(0, 50).map(([a, bal]) => {
    const pct =
      totalSupply === 0n ? 0 : Number((bal * 10000n) / totalSupply) / 100;
    const balanceFormatted =
      decimals !== undefined ? formatDecimals(bal, decimals) : bal.toString();
    return {
      address: a,
      balance: balanceFormatted,
      pct,
      label: SYSTEM_LABELS[a] ?? null,
    };
  });

  let creator_hold_pct: number | null = null;
  if (creatorAddress !== null) {
    const creatorBal = balances.get(creatorAddress) ?? 0n;
    if (creatorBal > 0n && totalSupply > 0n) {
      creator_hold_pct =
        Number((creatorBal * 10000n) / totalSupply) / 100;
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
    const diff =
      totalSupply > knownSupply ? totalSupply - knownSupply : knownSupply - totalSupply;
    const tolerance = knownSupply / 100n;
    if (diff > tolerance) {
      coverage = "partial";
      coverage_note = `Reconstructed supply (${totalSupply.toString()}) diverges from on-chain totalSupply (${knownSupply.toString()}) by > 1%. Ingest cursor may be lagging or some Transfer shape is unparsed.`;
    }
  }

  return {
    total_holders: holders.length,
    top5_pct: pctOf(5),
    top10_pct: pctOf(10),
    top20_pct: pctOf(20),
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
  totalElapsedMs: number;
}

/** Refresh `holder_snapshots` for every tracked stablecoin by replaying the
 * Transfer events already indexed in the `events` table.  Cheap enough (~ms
 * per token) to run every 5–30 min. */
export async function refreshHolderSnapshots(): Promise<BuildResult> {
  const startedAt = Date.now();

  // One RPC call up front to anchor asOfBlock; we use the same block number
  // across every token in this run so the snapshots share a consistent
  // "as of" semantics even though event replay is DB-driven.
  let asOfBlock: number | undefined;
  try {
    asOfBlock = Number(await getBlockNumber(tempoClient));
  } catch {
    /* leave as undefined */
  }

  let complete = 0;
  let partial = 0;
  let unavailable = 0;

  for (const stable of KNOWN_STABLECOINS) {
    try {
      const { supply, decimals } = await getSupplyAndDecimals(
        stable.address,
      );
      const snapshot = await snapshotHoldersFromEvents(
        stable.address,
        decimals,
        supply,
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
    totalElapsedMs: Date.now() - startedAt,
  };
}
