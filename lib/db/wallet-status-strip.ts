import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { recentFeed, type FeedRow } from "@/lib/db/agent-events";

// Powers the bottom-of-page status strip across every wallet/Wallet surface.
// Chain-wide stats — not filtered by user. Matches the "Wallet runs
// underneath everything" thesis: same numbers everywhere, ambient signal.
//
// Query budget: 2 round-trips per /api/wallet/status-strip call.
//   1. Aggregate (count + sum) over the 24h window
//   2. Hourly buckets for the sparkline
// Plus one separate call for the most-recent event row (lib/db/agent-events).
//
// Refreshes every 30s on the client. Live last-event updates piggyback on
// the existing /api/feed SSE bus — no new bus channel needed.

const STABLE_DECIMALS = 6; // USDC.e + USDT0 are both 6-decimal TIP-20s

export type StatusStrip = {
  windowHours: number;
  txs: number;
  agentsActive: number;
  volumeUsd: number;
  // 24 hourly tx-count buckets, oldest → newest. Zero-filled for empty hours.
  sparkline: number[];
  // Most recent decoded event, or null if the table is empty.
  lastEvent: {
    id: number;
    agentLabel: string;
    summary: string;
    ts: string;
    txHash: string;
  } | null;
};

function formatLastEvent(r: FeedRow | null): StatusStrip["lastEvent"] {
  if (!r) return null;
  return {
    id: r.id,
    agentLabel: r.agentLabel,
    summary: r.summary,
    ts: r.ts.toISOString(),
    txHash: r.txHash,
  };
}

export async function loadStatusStrip(): Promise<StatusStrip> {
  const windowHours = 24;

  // (1) Aggregate over the window.
  const agg = await db.execute<{
    tx_count: string;
    agents_active: string;
    amount_sum_wei: string | null;
  }>(sql`
    SELECT
      COUNT(*)::text                              AS tx_count,
      COUNT(DISTINCT agent_id)::text              AS agents_active,
      COALESCE(SUM(amount_wei::numeric), 0)::text AS amount_sum_wei
    FROM agent_events
    WHERE ts > now() - interval '24 hours'
  `);
  const top = agg.rows[0] ?? { tx_count: "0", agents_active: "0", amount_sum_wei: "0" };

  // (2) Hourly buckets for the sparkline.
  const buckets = await db.execute<{ bucket_iso: string; tx_count: string }>(sql`
    SELECT
      to_char(date_trunc('hour', ts), 'YYYY-MM-DD"T"HH24:00:00"Z"') AS bucket_iso,
      COUNT(*)::text AS tx_count
    FROM agent_events
    WHERE ts > now() - interval '24 hours'
    GROUP BY date_trunc('hour', ts)
    ORDER BY date_trunc('hour', ts)
  `);

  // Zero-fill the 24-hour window so the sparkline has a stable shape even
  // when there are quiet stretches.
  const now = new Date();
  const sparkline: number[] = new Array(24).fill(0);
  const hourMs = 60 * 60 * 1000;
  const baseHour = Math.floor(now.getTime() / hourMs) - 23;
  const byHour = new Map<number, number>();
  for (const row of buckets.rows) {
    const t = new Date(row.bucket_iso).getTime();
    if (Number.isFinite(t)) {
      byHour.set(Math.floor(t / hourMs), Number(row.tx_count));
    }
  }
  for (let i = 0; i < 24; i++) {
    sparkline[i] = byHour.get(baseHour + i) ?? 0;
  }

  const recent = await recentFeed(1);
  const lastEvent = formatLastEvent(recent[0] ?? null);

  // 24h volume in USD — both supported stables are 6-decimal pegged to $1,
  // so wei → USD is just / 10^6. (Future: tokenize when non-pegged tokens
  // ship; for now this is a fine approximation.)
  const wei = BigInt(top.amount_sum_wei ?? "0");
  const divisor = BigInt(10) ** BigInt(STABLE_DECIMALS);
  const volumeUsd = Number(wei / divisor) + Number(wei % divisor) / Number(divisor);

  return {
    windowHours,
    txs: Number(top.tx_count),
    agentsActive: Number(top.agents_active),
    volumeUsd,
    sparkline,
    lastEvent,
  };
}
