import { tempoClient } from "@/lib/rpc";
import type { HolderData } from "@/lib/types";
import { TEMPO_ADDRESSES } from "@/lib/types";
import { getBlockNumber } from "viem/actions";

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
//   2. Max results: 20,000 logs
// Start with a comfortable chunk and adaptively shrink on overflow.
const BLOCK_CHUNK = 10_000n;
const PARALLEL_CHUNKS = 6;

/** Fetch Transfer events for a single block range, shrinking adaptively if
 * Tempo rejects for either limit. Uses RPC-suggested ranges when available. */
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
    // Parse the RPC's hint, e.g. "retry with the range 10100000-10104417"
    const detail =
      // @ts-expect-error viem error shape
      err?.cause?.message ?? err?.details ?? (err instanceof Error ? err.message : "");
    const hint = /retry with the range (\d+)-(\d+)/.exec(String(detail));
    if (hint) {
      const newTo = BigInt(hint[2]);
      const head = await fetchRange(address, from, newTo);
      const tail = newTo + 1n <= to ? await fetchRange(address, newTo + 1n, to) : [];
      return [...head, ...tail];
    }
    // Block-range overflow — split in half and retry.
    if (String(detail).includes("max block range") && to > from) {
      const mid = from + (to - from) / 2n;
      const head = await fetchRange(address, from, mid);
      const tail = await fetchRange(address, mid + 1n, to);
      return [...head, ...tail];
    }
    throw err;
  }
}

/** Paginate across the full chain — parallel at the outer loop, adaptive at
 * each range. Safe for Tempo's 100k-block / 20k-result caps. */
async function fetchAllTransferLogs(address: `0x${string}`) {
  const latest = await getBlockNumber(tempoClient);
  const ranges: Array<{ from: bigint; to: bigint }> = [];
  for (let start = 0n; start <= latest; start += BLOCK_CHUNK) {
    const end = start + BLOCK_CHUNK - 1n < latest ? start + BLOCK_CHUNK - 1n : latest;
    ranges.push({ from: start, to: end });
  }

  const out: Awaited<ReturnType<typeof tempoClient.getContractEvents>> = [];
  for (let i = 0; i < ranges.length; i += PARALLEL_CHUNKS) {
    const batch = ranges.slice(i, i + PARALLEL_CHUNKS);
    const results = await Promise.all(batch.map((r) => fetchRange(address, r.from, r.to)));
    for (const logs of results) out.push(...logs);
  }
  return out;
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

/**
 * Scan all Transfer events for a token, reconstruct balances, compute concentration metrics.
 *
 * Strategy:
 * 1. Fetch every Transfer log from block 0 to latest via getContractEvents
 * 2. Replay events to build a balance map (bigint arithmetic, no rounding)
 * 3. Detect creator = first address that received a mint (from == zero address)
 * 4. Strip burn addresses, sort by balance desc, compute top-N percentages
 * 5. Return top 50 holders with human-readable labels for known system addresses
 */
export async function getHolders(
  address: `0x${string}`,
  decimals?: number
): Promise<HolderData> {
  // Fetch all Transfer events from genesis to latest (paginated — Tempo RPC
  // rejects >100k block ranges per call).
  const logs = await fetchAllTransferLogs(address);

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
  const divisor = decimals !== undefined ? 10n ** BigInt(decimals) : 1n;

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

  return {
    total_holders: holders.length,
    top5_pct,
    top10_pct,
    top20_pct,
    creator_address: creatorAddress,
    creator_hold_pct,
    top_holders,
  };
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
