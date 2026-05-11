"use client";

import { useEffect, useState } from "react";
import { fetchSyncEvents, type SyncEvent } from "@/lib/pltn/candles";
import {
  PLTN,
  PAIR,
  V2_ROUTER,
  V2_FACTORY,
  DEPLOYER_EOA,
  GENESIS_TX,
  EXPLORER_URL,
  RPC_URL,
  TOTAL_SUPPLY,
} from "@/lib/pltn/constants";

const DEAD = "0x000000000000000000000000000000000000dEaD" as const;
const BALANCE_OF_SELECTOR = "0x70a08231";

async function balanceOf(token: string, holder: string): Promise<bigint> {
  const addr = holder.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [{ to: token, data: BALANCE_OF_SELECTOR + addr }, "latest"],
      id: 1,
    }),
  });
  const json = (await res.json()) as { result?: string };
  return BigInt(json.result ?? "0x0");
}

type Holder = {
  label: string;
  address: `0x${string}` | null;
  balance: bigint;
  pct: number;
};

async function fetchHolders(): Promise<Holder[]> {
  const targets = [
    { label: "Deployer", address: DEPLOYER_EOA },
    { label: "LP pair", address: PAIR },
    { label: "Burned", address: DEAD },
  ];
  const balances = await Promise.all(
    targets.map((t) => balanceOf(PLTN, t.address)),
  );
  const sumKnown = balances.reduce((a, b) => a + b, 0n);
  const circulating = TOTAL_SUPPLY > sumKnown ? TOTAL_SUPPLY - sumKnown : 0n;
  const rows: Holder[] = [
    ...targets.map((t, i) => ({
      label: t.label,
      address: t.address as `0x${string}`,
      balance: balances[i],
      pct: 0,
    })),
    { label: "Circulating", address: null, balance: circulating, pct: 0 },
  ];
  for (const r of rows) {
    r.pct = Number((r.balance * 10_000n) / TOTAL_SUPPLY) / 100;
  }
  return rows;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function formatPLTN(raw: bigint): string {
  const n = Number(raw) / 1e6;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  if (n === 0) return "0";
  return n.toFixed(2);
}

function formatPrice(n: number): string {
  if (n >= 1) return `$${n.toFixed(4)}`;
  const s = n.toFixed(10);
  return `$${s.replace(/0+$/, "").replace(/\.$/, "")}`;
}

function formatRelative(ts: number): string {
  const diff = Math.max(0, Date.now() / 1000 - ts);
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

type Trade = {
  txHash: `0x${string}`;
  timestamp: number;
  price: number;
  pltnDelta: bigint; // signed; positive = pair gained PLTN (sell), negative = pair lost PLTN (buy)
};

function deriveTrades(events: SyncEvent[]): Trade[] {
  const out: Trade[] = [];
  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const cur = events[i];
    out.push({
      txHash: cur.txHash,
      timestamp: cur.timestamp,
      price: cur.price,
      pltnDelta: cur.reserve1 - prev.reserve1,
    });
  }
  return out;
}

export function InfoPanel() {
  const [holders, setHolders] = useState<Holder[] | null>(null);
  const [trades, setTrades] = useState<Trade[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [h, ev] = await Promise.all([fetchHolders(), fetchSyncEvents()]);
        if (cancelled) return;
        setHolders(h);
        setTrades(deriveTrades(ev).slice(-12).reverse());
      } catch {
        // keep loading state; transient network failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const holderRows = holders ?? [
    { label: "Deployer", address: null, balance: 0n, pct: 0 },
    { label: "LP pair", address: null, balance: 0n, pct: 0 },
    { label: "Burned", address: null, balance: 0n, pct: 0 },
    { label: "Circulating", address: null, balance: 0n, pct: 0 },
  ];

  return (
    <div className="pltn-info">
      <section className="pltn-info-block">
        <header className="pltn-info-h">
          <span>Holders</span>
          <span>$PLTN</span>
        </header>
        <div className="pltn-info-table">
          <div className="pltn-info-row pltn-info-row-3 pltn-info-row-head">
            <span>Address</span>
            <span className="pltn-info-num">Balance</span>
            <span className="pltn-info-num">%</span>
          </div>
          {holderRows.map((h, i) => (
            <div
              key={i}
              className="pltn-info-row pltn-info-row-3"
              data-loading={holders ? 0 : 1}
            >
              <span className="pltn-info-cell-addr">
                <span className="pltn-info-label">{h.label}</span>
                {h.address ? (
                  <a
                    className="pltn-info-addr"
                    href={`${EXPLORER_URL}/address/${h.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {shortAddr(h.address)}
                  </a>
                ) : (
                  <span className="pltn-info-addr pltn-info-addr-muted">—</span>
                )}
              </span>
              <span className="pltn-info-num">
                {holders ? formatPLTN(h.balance) : "—"}
              </span>
              <span className="pltn-info-num">
                {holders ? `${h.pct.toFixed(2)}%` : "—"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="pltn-info-block">
        <header className="pltn-info-h">
          <span>Contracts</span>
          <span>Tempo mainnet</span>
        </header>
        <div className="pltn-info-table">
          {[
            { label: "$PLTN token", address: PLTN, kind: "address" as const },
            { label: "PLTN / pathUSD pair", address: PAIR, kind: "address" as const },
            { label: "V2 router", address: V2_ROUTER, kind: "address" as const },
            { label: "V2 factory", address: V2_FACTORY, kind: "address" as const },
            { label: "Genesis tx", address: GENESIS_TX, kind: "tx" as const },
          ].map((c) => (
            <div key={c.address} className="pltn-info-row pltn-info-row-2">
              <span className="pltn-info-label">{c.label}</span>
              <a
                className="pltn-info-addr pltn-info-num"
                href={`${EXPLORER_URL}/${c.kind === "tx" ? "tx" : "address"}/${c.address}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {shortAddr(c.address)}
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className="pltn-info-block">
        <header className="pltn-info-h">
          <span>Recent trades</span>
          <span>
            {trades === null ? "loading…" : trades.length === 0 ? "none yet" : `${trades.length} shown`}
          </span>
        </header>
        <div className="pltn-info-table">
          <div className="pltn-info-row pltn-info-row-4 pltn-info-row-head">
            <span>Time</span>
            <span>Side</span>
            <span className="pltn-info-num">Price</span>
            <span className="pltn-info-num">Tx</span>
          </div>
          {trades && trades.length === 0 && (
            <div className="pltn-info-row pltn-info-empty">No trades yet.</div>
          )}
          {(trades ?? []).map((t) => {
            const isBuy = t.pltnDelta < 0n;
            return (
              <div key={t.txHash} className="pltn-info-row pltn-info-row-4">
                <span>{formatRelative(t.timestamp)}</span>
                <span
                  className="pltn-info-side"
                  data-side={isBuy ? "buy" : "sell"}
                >
                  {isBuy ? "Buy" : "Sell"}
                </span>
                <span className="pltn-info-num">{formatPrice(t.price)}</span>
                <a
                  className="pltn-info-addr pltn-info-num"
                  href={`${EXPLORER_URL}/tx/${t.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {shortAddr(t.txHash)}
                </a>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
