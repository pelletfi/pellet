// Read helpers for the PLTN/pathUSD Uniswap V2 pair.
// All callers are public — no authentication required.

import { createPublicClient, http, parseAbi, type Address } from "viem";
import { tempo } from "viem/chains";
import { PAIR, PLTN, PATH_USD, RPC_URL, V2_ROUTER } from "./constants";

export const publicClient = createPublicClient({
  chain: tempo,
  transport: http(RPC_URL),
});

const ROUTER_ABI = parseAbi([
  "function getAmountsOut(uint256 amountIn, address[] calldata path) view returns (uint256[] memory amounts)",
]);

const ERC20_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
]);

export type PairReserves = {
  pltnReserveRaw: bigint;
  quoteReserveRaw: bigint;
  /** USD per PLTN, scaled by 1e12 to keep precision in bigint */
  priceScaled12: bigint;
  /** total liquidity in pathUSD raw units (one side × 2) */
  liquidityQuoteRaw: bigint;
};

// Tempo's V2 pair `getReserves()` reverts on `eth_call` (verified 2026-05-09).
// `balanceOf` on each token works fine and is equivalent for an unsynced pair —
// reserves only diverge from balances when there are donated tokens, which we
// don't expect for a fresh pair. Two parallel reads, no multicall dependency.
export async function readPair(): Promise<PairReserves> {
  const [quoteReserveRaw, pltnReserveRaw] = (await Promise.all([
    publicClient.readContract({
      address: PATH_USD,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [PAIR],
    }),
    publicClient.readContract({
      address: PLTN,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [PAIR],
    }),
  ])) as [bigint, bigint];
  const priceScaled12 =
    pltnReserveRaw === 0n ? 0n : (quoteReserveRaw * 10n ** 12n) / pltnReserveRaw;
  const liquidityQuoteRaw = quoteReserveRaw * 2n;
  return { pltnReserveRaw, quoteReserveRaw, priceScaled12, liquidityQuoteRaw };
}

export async function quoteBuy(amountInRaw: bigint): Promise<bigint> {
  if (amountInRaw <= 0n) return 0n;
  const out = (await publicClient.readContract({
    address: V2_ROUTER,
    abi: ROUTER_ABI,
    functionName: "getAmountsOut",
    args: [amountInRaw, [PATH_USD, PLTN]],
  })) as bigint[];
  return out[1];
}

export async function quoteSell(amountInRaw: bigint): Promise<bigint> {
  if (amountInRaw <= 0n) return 0n;
  const out = (await publicClient.readContract({
    address: V2_ROUTER,
    abi: ROUTER_ABI,
    functionName: "getAmountsOut",
    args: [amountInRaw, [PLTN, PATH_USD]],
  })) as bigint[];
  return out[1];
}

export async function totalSupplyOf(token: Address): Promise<bigint> {
  return (await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "totalSupply",
  })) as bigint;
}

/** Format a 6-decimal token raw value as a fixed-precision string. */
export function format6(raw: bigint, decimals = 2): string {
  const whole = raw / 10n ** 6n;
  const frac = raw % 10n ** 6n;
  if (decimals === 0) return whole.toString();
  const fracStr = frac.toString().padStart(6, "0").slice(0, decimals);
  return `${whole.toString()}.${fracStr}`;
}

/** Format with thousand separators. */
export function formatThousands(n: bigint | number): string {
  return n.toLocaleString("en-US");
}

/** Format a price (USD-per-PLTN) from priceScaled12 (12 decimals of precision). */
export function formatPrice(priceScaled12: bigint): string {
  if (priceScaled12 === 0n) return "—";
  const whole = priceScaled12 / 10n ** 12n;
  const frac = priceScaled12 % 10n ** 12n;
  const fracStr = frac.toString().padStart(12, "0");
  // Show 6-8 sig figs for sub-dollar prices
  const trimmed = fracStr.replace(/0+$/, "").slice(0, 10) || "0";
  return `${whole.toString()}.${trimmed}`;
}

/** Compact USD format: 4000 → $4K, 1234567 → $1.23M, etc. */
export function formatCompactUSD(raw: bigint): string {
  const usd = Number(raw) / 1e6;
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M`;
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(usd >= 1e4 ? 1 : 2)}K`;
  return `$${usd.toFixed(2)}`;
}

/** Compact PLTN format. */
export function formatCompactPLTN(raw: bigint): string {
  const n = Number(raw) / 1e6;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(2);
}
