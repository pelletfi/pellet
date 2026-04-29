import { parseAbiItem, type Address } from "viem";
import { ingestClient } from "@/lib/rpc";
import { db } from "@/lib/db/client";
import { events, ingestionCursors, agents } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

// Per-tick chunk size — Tempo's native RPC handles 1000-block windows easily.
const CHUNK_BLOCKS = 1_000;
// Max blocks to advance per cron tick — keeps Vercel function under 300s budget.
const MAX_BLOCKS_PER_RUN = 100_000;
// Don't index unconfirmed blocks (helps with reorgs).
const CONFIRMATIONS = 2;
// On cold start: where to begin? Defaults to safeHead - 100. Override via env
// to backfill from a specific block (e.g., BACKFILL_FROM_BLOCK=0 for full).
const BACKFILL_FROM_BLOCK = process.env.BACKFILL_FROM_BLOCK
  ? Number(process.env.BACKFILL_FROM_BLOCK)
  : null;

const GLOBAL_CURSOR = "__global__";

// Transfer is the dominant event for agent activity (token moves in/out).
// Other event types (Swap, Mint, etc.) can be added as separate filtered
// passes — for v0 this single event covers >90% of what we want to surface.
const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

async function getCursor(): Promise<number> {
  const rows = await db
    .select()
    .from(ingestionCursors)
    .where(sql`${ingestionCursors.contract} = ${GLOBAL_CURSOR}`)
    .limit(1);
  return rows[0]?.lastBlock ?? 0;
}

async function setCursor(block: number): Promise<void> {
  await db
    .insert(ingestionCursors)
    .values({ contract: GLOBAL_CURSOR, lastBlock: block })
    .onConflictDoUpdate({
      target: ingestionCursors.contract,
      set: { lastBlock: block, updatedAt: new Date() },
    });
}

async function watchedWallets(): Promise<Address[]> {
  const activeAgents = await db
    .select({ wallets: agents.wallets })
    .from(agents)
    .where(sql`${agents.active} = true`);
  const set = new Set<string>();
  for (const a of activeAgents) {
    for (const w of a.wallets ?? []) {
      if (w && w.startsWith("0x")) set.add(w.toLowerCase());
    }
  }
  return [...set] as Address[];
}

export interface ProcessResult {
  blocksProcessed: number;
  eventsIngested: number;
  caughtUp: boolean;
  fromBlock: number;
  toBlock: number;
  watchedAgents: number;
}

export async function processEvents(): Promise<ProcessResult> {
  const chainHead = Number(await ingestClient.getBlockNumber());
  const safeHead = Math.max(0, chainHead - CONFIRMATIONS);
  const cursor = await getCursor();
  const coldStartBlock = BACKFILL_FROM_BLOCK ?? Math.max(0, safeHead - 100);
  const startBlock = cursor === 0 ? coldStartBlock : cursor + 1;
  const endBlock = Math.min(safeHead, startBlock + MAX_BLOCKS_PER_RUN);

  const wallets = await watchedWallets();

  if (startBlock > endBlock) {
    return {
      blocksProcessed: 0,
      eventsIngested: 0,
      caughtUp: true,
      fromBlock: startBlock,
      toBlock: endBlock,
      watchedAgents: wallets.length,
    };
  }

  if (wallets.length === 0) {
    // No watched agents yet — advance the cursor without ingesting so we
    // don't get stuck in cold-start the moment we add agents.
    await setCursor(endBlock);
    return {
      blocksProcessed: endBlock - startBlock + 1,
      eventsIngested: 0,
      caughtUp: endBlock === safeHead,
      fromBlock: startBlock,
      toBlock: endBlock,
      watchedAgents: 0,
    };
  }

  let inserted = 0;
  let from = startBlock;

  while (from <= endBlock) {
    const to = Math.min(from + CHUNK_BLOCKS - 1, endBlock);

    // Two filtered passes: Transfer events where `from` OR `to` is a watched
    // wallet. Filtered at RPC level via viem's args binding so we only fetch
    // events that actually involve our agents.
    const [logsFrom, logsTo] = await Promise.all([
      ingestClient.getLogs({
        fromBlock: BigInt(from),
        toBlock: BigInt(to),
        event: transferEvent,
        args: { from: wallets },
      }),
      ingestClient.getLogs({
        fromBlock: BigInt(from),
        toBlock: BigInt(to),
        event: transferEvent,
        args: { to: wallets },
      }),
    ]);

    // Dedupe (same log can match both passes if it's an internal transfer
    // between two watched agents).
    const seen = new Set<string>();
    const allLogs = [...logsFrom, ...logsTo].filter((l) => {
      const key = `${l.transactionHash}-${l.logIndex}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (allLogs.length > 0) {
      // Bulk-fetch block timestamps — one round-trip per unique block.
      const uniqueBlocks = [...new Set(allLogs.map((l) => l.blockNumber!))];
      const blockTimestamps = new Map<bigint, Date>();
      for (const bn of uniqueBlocks) {
        const block = await ingestClient.getBlock({ blockNumber: bn });
        blockTimestamps.set(bn, new Date(Number(block.timestamp) * 1000));
      }

      const rows = allLogs.map((log) => ({
        txHash: log.transactionHash!,
        logIndex: log.logIndex!,
        blockNumber: Number(log.blockNumber!),
        blockTimestamp: blockTimestamps.get(log.blockNumber!)!,
        contract: log.address.toLowerCase(),
        eventType: log.topics[0] ?? "unknown",
        args: { topics: log.topics, data: log.data },
      }));

      await db.insert(events).values(rows).onConflictDoNothing();
      inserted += rows.length;
    }

    from = to + 1;
  }

  await setCursor(endBlock);

  return {
    blocksProcessed: endBlock - startBlock + 1,
    eventsIngested: inserted,
    caughtUp: endBlock === safeHead,
    fromBlock: startBlock,
    toBlock: endBlock,
    watchedAgents: wallets.length,
  };
}
