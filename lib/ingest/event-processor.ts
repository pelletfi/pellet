import { tempoClient } from "@/lib/rpc";
import { db } from "@/lib/db";
import { events, ingestionCursors } from "@/lib/db/schema";
import { KNOWN_STABLECOINS } from "@/lib/pipeline/stablecoins";
import { TEMPO_ADDRESSES } from "@/lib/types";
import { TIP20_EVENT_ABI, TIP403_EVENT_ABI } from "./abi";
import { sql } from "drizzle-orm";

// Per-tick chunk size. Chosen to stay well under RPC getLogs limits.
const CHUNK_BLOCKS = 500;
// Max blocks to advance per invocation — keeps Vercel cron under the 300s budget.
const MAX_BLOCKS_PER_RUN = 5_000;
// Safety buffer: don't index unconfirmed blocks (helps with reorgs).
const CONFIRMATIONS = 2;

// All contracts whose events we ingest.
const WATCHED_CONTRACTS = [
  ...KNOWN_STABLECOINS.map((s) => s.address),
  TEMPO_ADDRESSES.tip403Registry,
];

interface Cursor {
  contract: string;
  lastBlock: number;
}

// We use a SINGLE cursor called `__global__` because getLogs filters by
// `address` list and returns chronologically — ordering across all
// watched contracts is maintained by block + logIndex.
const GLOBAL_CURSOR = "__global__";

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

function matchEventAbi(topic0: string, topics: readonly string[], data: string) {
  // Try each ABI; viem decodes via its own helpers in the cron route.
  // We just return raw topics + data here — actual decoding happens downstream.
  return { topic0, topics, data };
}

export interface ProcessResult {
  blocksProcessed: number;
  eventsIngested: number;
  caughtUp: boolean;
  fromBlock: number;
  toBlock: number;
}

export async function processEvents(): Promise<ProcessResult> {
  const chainHead = Number(await tempoClient.getBlockNumber());
  const safeHead = Math.max(0, chainHead - CONFIRMATIONS);
  const cursor = await getCursor();
  const startBlock = cursor === 0 ? safeHead - 100 : cursor + 1; // genesis-lite: only last 100 blocks on cold start
  const endBlock = Math.min(safeHead, startBlock + MAX_BLOCKS_PER_RUN);

  if (startBlock > endBlock) {
    return { blocksProcessed: 0, eventsIngested: 0, caughtUp: true, fromBlock: startBlock, toBlock: endBlock };
  }

  let inserted = 0;
  let from = startBlock;

  while (from <= endBlock) {
    const to = Math.min(from + CHUNK_BLOCKS - 1, endBlock);
    const logs = await tempoClient.getLogs({
      address: WATCHED_CONTRACTS,
      fromBlock: BigInt(from),
      toBlock: BigInt(to),
    });

    if (logs.length > 0) {
      // Fetch block timestamps in bulk — one round-trip per unique block touched.
      const uniqueBlocks = [...new Set(logs.map((l) => l.blockNumber!))];
      const blockTimestamps = new Map<bigint, Date>();
      for (const bn of uniqueBlocks) {
        const block = await tempoClient.getBlock({ blockNumber: bn });
        blockTimestamps.set(bn, new Date(Number(block.timestamp) * 1000));
      }

      const rows = logs.map((log) => ({
        txHash: log.transactionHash!,
        logIndex: log.logIndex!,
        blockNumber: Number(log.blockNumber!),
        blockTimestamp: blockTimestamps.get(log.blockNumber!)!,
        contract: log.address.toLowerCase(),
        eventType: log.topics[0] ?? "unknown", // raw topic0; decoded later
        args: {
          topics: log.topics,
          data: log.data,
        },
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
  };
}

// Suppress unused — we export ABIs for downstream decoders.
export { TIP20_EVENT_ABI, TIP403_EVENT_ABI, matchEventAbi };
