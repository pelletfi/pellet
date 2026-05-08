"use client";

import { useEffect, useRef, useState } from "react";

type StatusStrip = {
  windowHours: number;
  txs: number;
  agentsActive: number;
  volumeUsd: number;
  sparkline: number[];
  lastEvent: {
    id: number;
    agentLabel: string;
    summary: string;
    ts: string;
    txHash: string;
  } | null;
};

const POLL_MS = 30_000;

function fmtUsdCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `$${(n / 1_000).toFixed(1)}k`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}k`;
  return n.toLocaleString();
}

function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Tiny step-line sparkline. Per the chart memory: blocky, square edges,
// step lines, no gradients. Pure SVG, no chart lib.
function Sparkline({ values, width = 64, height = 16 }: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length === 0) return null;
  const max = Math.max(1, ...values);
  const stepX = width / values.length;
  const points: string[] = [];
  values.forEach((v, i) => {
    const y = height - (v / max) * height;
    const x0 = i * stepX;
    const x1 = (i + 1) * stepX;
    if (i === 0) points.push(`M ${x0.toFixed(2)} ${y.toFixed(2)}`);
    points.push(`L ${x0.toFixed(2)} ${y.toFixed(2)}`);
    points.push(`L ${x1.toFixed(2)} ${y.toFixed(2)}`);
  });
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="spec-status-spark"
      aria-hidden="true"
    >
      <path d={points.join(" ")} fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function SpecimenStatusStrip() {
  const [data, setData] = useState<StatusStrip | null>(null);
  const [agoTick, setAgoTick] = useState(0);
  const seenLastEventId = useRef<number | null>(null);

  // Fetch + poll the strip data.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/wallet/status-strip", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as StatusStrip;
        if (!cancelled) {
          setData(json);
          if (json.lastEvent) seenLastEventId.current = json.lastEvent.id;
        }
      } catch {
        // swallow — strip is ambient, not critical
      }
    }
    void load();
    const interval = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Live last-event updates via the existing Wallet feed SSE bus.
  useEffect(() => {
    const es = new EventSource("/api/feed");
    es.onmessage = (msg) => {
      try {
        const wire = JSON.parse(msg.data) as {
          id: number | string;
          agentLabel: string;
          summary: string;
          ts: string;
          txSig: string;
        };
        const id = Number(wire.id);
        if (!Number.isFinite(id)) return;
        if (seenLastEventId.current === id) return;
        seenLastEventId.current = id;
        setData((prev) =>
          prev
            ? {
                ...prev,
                lastEvent: {
                  id,
                  agentLabel: wire.agentLabel,
                  summary: wire.summary,
                  ts: wire.ts,
                  txHash: wire.txSig,
                },
                txs: prev.txs + 1,
              }
            : prev,
        );
      } catch {
        // skip
      }
    };
    es.onerror = () => {
      // Auto-reconnects.
    };
    return () => es.close();
  }, []);

  // Tick once a second so "Xs ago" updates without a re-fetch.
  useEffect(() => {
    const t = setInterval(() => setAgoTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!data) {
    return (
      <footer className="spec-status-strip" aria-label="Chain status">
        <span className="spec-status-cell">
          <span className="spec-status-label">PELLET</span>
          <span className="spec-status-value">…</span>
        </span>
      </footer>
    );
  }

  return (
    <footer className="spec-status-strip" aria-label="Chain status">
      <span className="spec-status-cell">
        <span className="spec-status-label">MPP TXS · 24H</span>
        <span className="spec-status-value">{fmtCount(data.txs)}</span>
        <Sparkline values={data.sparkline} />
      </span>
      <span className="spec-status-cell">
        <span className="spec-status-label">VOLUME · 24H</span>
        <span className="spec-status-value">{fmtUsdCompact(data.volumeUsd)}</span>
      </span>
      <span className="spec-status-cell">
        <span className="spec-status-label">AGENTS · 24H</span>
        <span className="spec-status-value">{data.agentsActive}</span>
      </span>
      {data.lastEvent && (
        <span
          className="spec-status-cell spec-status-cell-last"
          title={data.lastEvent.summary}
          // agoTick is read here so the closure subscribes to the tick
          // and re-renders the timestamp every second.
          data-tick={agoTick}
        >
          <span className="spec-status-label">LAST · {fmtAgo(data.lastEvent.ts)}</span>
          <span className="spec-status-value spec-status-value-trim">
            <span className="spec-status-agent">{data.lastEvent.agentLabel}</span>
            <span className="spec-status-sep">·</span>
            <span className="spec-status-summary">{data.lastEvent.summary}</span>
          </span>
        </span>
      )}
    </footer>
  );
}
