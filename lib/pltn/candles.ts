// OHLC candle generation from Uniswap V2 Sync events on the PLTN/pathUSD pair.
//
// Sync(uint112 reserve0, uint112 reserve1) fires on every swap and on every
// addLiquidity / removeLiquidity. Reserve0 = pathUSD, reserve1 = PLTN
// (verified via pair.token0()/token1() during deploy). Price-per-PLTN in USD
// is reserve0 / reserve1 (both 6-decimal, so the ratio is dimensionless).
//
// Tempo TIP-20 Transfer events don't surface in eth_getLogs, but the pair
// is a regular V2 contract emitting standard EVM events — Sync queries work.

import { PAIR, RPC_URL, GENESIS_BLOCK } from "./constants";

const SYNC_TOPIC =
  "0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1";

export type SyncEvent = {
  blockNumber: number;
  timestamp: number; // unix seconds
  reserve0: bigint; // pathUSD raw (6 dec)
  reserve1: bigint; // PLTN raw (6 dec)
  price: number; // USD per PLTN
};

export type Candle = {
  time: number; // bucket start (unix seconds), required by lightweight-charts
  open: number;
  high: number;
  low: number;
  close: number;
};

// Tempo's RPC caps eth_getLogs at 100k blocks per query, so chunk across the
// full history. Genesis-to-head is already >100k blocks as of 2026-05-11.
const MAX_BLOCK_RANGE = 100_000n;

async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result as T;
}

export async function fetchSyncEvents(
  fromBlock: bigint = GENESIS_BLOCK,
): Promise<SyncEvent[]> {
  const headHex = await rpcCall<string>("eth_blockNumber", []);
  const head = BigInt(headHex);
  const logs: RawLog[] = [];
  for (let start = fromBlock; start <= head; start += MAX_BLOCK_RANGE) {
    const end = start + MAX_BLOCK_RANGE - 1n < head ? start + MAX_BLOCK_RANGE - 1n : head;
    const chunk = await rpcCall<RawLog[]>("eth_getLogs", [
      {
        address: PAIR,
        topics: [SYNC_TOPIC],
        fromBlock: `0x${start.toString(16)}`,
        toBlock: `0x${end.toString(16)}`,
      },
    ]);
    logs.push(...chunk);
  }
  return logs
    .map(parseSyncLog)
    .filter((e): e is SyncEvent => e !== null)
    .sort((a, b) => a.timestamp - b.timestamp);
}

type RawLog = {
  blockNumber: string;
  blockTimestamp?: string;
  data: string;
};

function parseSyncLog(log: RawLog): SyncEvent | null {
  if (!log.blockTimestamp) return null;
  const data = log.data.slice(2);
  if (data.length < 128) return null;
  const reserve0 = BigInt("0x" + data.slice(0, 64));
  const reserve1 = BigInt("0x" + data.slice(64, 128));
  if (reserve1 === 0n) return null;
  const price = Number(reserve0) / Number(reserve1);
  return {
    blockNumber: parseInt(log.blockNumber, 16),
    timestamp: parseInt(log.blockTimestamp, 16),
    reserve0,
    reserve1,
    price,
  };
}

/**
 * Group events into OHLC candles by time bucket.
 * `intervalSec` = candle width (60=1m, 300=5m, 3600=1h, etc.).
 *
 * Forward-fill: empty buckets between events get a candle at the previous
 * close price (open=high=low=close=prev_close). Keeps the chart continuous
 * during low-volume periods. Skip if `forwardFill: false`.
 */
export function bucketIntoCandles(
  events: SyncEvent[],
  intervalSec: number,
  opts: { forwardFill?: boolean; until?: number } = {},
): Candle[] {
  if (events.length === 0) return [];
  const { forwardFill = true, until = Math.floor(Date.now() / 1000) } = opts;

  const buckets = new Map<number, number[]>();
  for (const e of events) {
    const bucket = Math.floor(e.timestamp / intervalSec) * intervalSec;
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push(e.price);
  }

  const sortedKeys = [...buckets.keys()].sort((a, b) => a - b);
  const candles: Candle[] = [];
  let prevClose = events[0].price;

  const start = sortedKeys[0];
  const end = Math.floor(until / intervalSec) * intervalSec;

  for (let t = start; t <= end; t += intervalSec) {
    const prices = buckets.get(t);
    if (prices && prices.length > 0) {
      candles.push({
        time: t,
        open: prevClose,
        high: Math.max(prevClose, ...prices),
        low: Math.min(prevClose, ...prices),
        close: prices[prices.length - 1],
      });
      prevClose = prices[prices.length - 1];
    } else if (forwardFill) {
      candles.push({
        time: t,
        open: prevClose,
        high: prevClose,
        low: prevClose,
        close: prevClose,
      });
    }
  }
  return candles;
}

/** Pick a candle interval based on how much trade history exists. */
export function pickInterval(events: SyncEvent[]): {
  intervalSec: number;
  label: string;
} {
  if (events.length === 0) return { intervalSec: 3600, label: "1H" };
  const span = events[events.length - 1].timestamp - events[0].timestamp;
  // < 1h of data: 1m candles
  if (span < 3600) return { intervalSec: 60, label: "1M" };
  // < 1d: 5m
  if (span < 86400) return { intervalSec: 300, label: "5M" };
  // < 1w: 15m
  if (span < 604800) return { intervalSec: 900, label: "15M" };
  // otherwise 1h
  return { intervalSec: 3600, label: "1H" };
}
