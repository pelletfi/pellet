// Pure formatters used across the Wallet surface. No React, no DB, no IO.

export function formatUsdcAmount(
  wei: string | null | undefined,
  decimals: number,
): string {
  if (wei == null) return "—";
  const n = Number(wei) / 10 ** decimals;
  if (n === 0) return "$0.00";
  if (n < 0.01) {
    // Sub-cent: show 3 decimals so 0.003 USDC.e isn't rounded to $0.00.
    return `$${n.toFixed(3)}`;
  }
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatTimeAgo(ts: Date, now: Date = new Date()): string {
  const diffSec = Math.floor((now.getTime() - ts.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function shortHash(hash: string): string {
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export function shortAddress(addr: string): string {
  return shortHash(addr); // same shape — 6+4 with ellipsis
}

export function formatBlockNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export type Tone = "positive" | "negative" | "neutral";
export type Delta = { display: string; tone: Tone };

export function formatDelta(ratio: number | null | undefined): Delta {
  if (ratio == null) return { display: "—", tone: "neutral" };
  if (ratio === 0) return { display: "0.0%", tone: "neutral" };
  const pct = (ratio * 100).toFixed(1);
  if (ratio > 0) return { display: `+${pct}%`, tone: "positive" };
  return { display: `${pct}%`, tone: "negative" };
}
