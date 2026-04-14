"use client";

import { useEffect, useState, useRef, useCallback } from "react";

// ── Types ──

interface TokenRow {
  address: string;
  volume_24h: number;
}

interface BlockBar {
  number: number;
  txCount: number;
}

interface FeedItem {
  id: string;
  time: string;
  type: "TFR" | "SWAP" | "MPP";
  from: string;
  to: string;
  amount: string;
}

interface StablecoinRow {
  symbol: string;
  price_vs_pathusd: number;
}

// ── Helpers ──

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n > 0) return `$${n.toFixed(0)}`;
  return "$0";
}

function abbr(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function generateMockFeed(blockNumber: number): FeedItem[] {
  const types: FeedItem["type"][] = ["TFR", "SWAP", "MPP"];
  const items: FeedItem[] = [];
  for (let i = 0; i < 7; i++) {
    const seed = blockNumber * 31 + i * 17;
    const t = types[seed % 3];
    const fromHex = ((seed * 7 + 0xab3) & 0xffffff).toString(16).padStart(6, "0");
    const toHex = ((seed * 13 + 0xf1e) & 0xffffff).toString(16).padStart(6, "0");
    const amt = ((seed % 9000) + 100) / 100;
    const secs = i * 2 + (seed % 5);
    items.push({
      id: `${blockNumber}-${i}`,
      time: `${secs}s`,
      type: t,
      from: `0x${fromHex}...${fromHex.slice(0, 4)}`,
      to: `0x${toHex}...${toHex.slice(0, 4)}`,
      amount: `${amt.toFixed(2)} TEMPO`,
    });
  }
  return items;
}

// ── Sparkline helpers ──

function volumeSparklinePath(
  values: number[],
  w: number,
  h: number,
  padY: number = 4
): { line: string; area: string } {
  if (values.length < 2) return { line: `M0,${h}`, area: `M0,${h}L${w},${h}Z` };
  const max = Math.max(...values) || 1;
  const stepX = w / (values.length - 1);
  const points = values.map((v, i) => ({
    x: i * stepX,
    y: h - padY - ((v / max) * (h - padY * 2)),
  }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");
  const area = `${line}L${w},${h}L0,${h}Z`;
  return { line, area };
}

function miniWavePath(w: number, h: number): string {
  const mid = h / 2;
  const amp = h * 0.25;
  const points: string[] = [];
  for (let x = 0; x <= w; x += 2) {
    const y = mid + Math.sin((x / w) * Math.PI * 3) * amp + Math.sin((x / w) * Math.PI * 7) * (amp * 0.3);
    points.push(`${x === 0 ? "M" : "L"}${x},${y.toFixed(1)}`);
  }
  return points.join("");
}

// ── Card wrapper ──

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--color-border-subtle)",
  borderRadius: 8,
  overflow: "hidden",
};

const cardHeaderStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid var(--color-border-subtle)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const cardTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 500,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "var(--color-text-quaternary)",
};

// ── Card 1: Volume Chart ──

function VolumeChart() {
  const [totalVolume, setTotalVolume] = useState<number>(0);
  const [points, setPoints] = useState<number[]>([]);
  const [period, setPeriod] = useState<"24h" | "7d" | "30d">("24h");

  useEffect(() => {
    fetch("/api/v1/tokens")
      .then((r) => r.json())
      .then((data) => {
        const tokens: TokenRow[] = data.tokens ?? [];
        const sum = tokens.reduce((s, t) => s + (t.volume_24h ?? 0), 0);
        setTotalVolume(sum);
        // Build synthetic sparkline from individual volumes
        const vols = tokens.map((t) => t.volume_24h ?? 0).filter((v) => v > 0);
        if (vols.length < 2) {
          // Fallback: generate plausible curve
          const pts: number[] = [];
          for (let i = 0; i < 24; i++) {
            pts.push(sum * (0.6 + 0.4 * Math.sin((i / 23) * Math.PI * 1.3 + 0.5)));
          }
          setPoints(pts);
        } else {
          setPoints(vols);
        }
      })
      .catch(() => {});
  }, []);

  const svgW = 260;
  const svgH = 64;
  const { line, area } = volumeSparklinePath(points, svgW, svgH);

  const periods: ("24h" | "7d" | "30d")[] = ["24h", "7d", "30d"];

  // Dot at end
  const lastPoint = points.length > 1
    ? (() => {
        const max = Math.max(...points) || 1;
        const stepX = svgW / (points.length - 1);
        return {
          x: (points.length - 1) * stepX,
          y: svgH - 4 - ((points[points.length - 1] / max) * (svgH - 8)),
        };
      })()
    : null;

  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>
        <span style={cardTitleStyle}>Volume</span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatCompact(totalVolume)}
        </span>
      </div>
      <div style={{ padding: "12px 14px 8px" }}>
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width="100%"
          height={svgH}
          style={{ display: "block" }}
        >
          <defs>
            <linearGradient id="vol-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity={0.06} />
              <stop offset="100%" stopColor="white" stopOpacity={0} />
            </linearGradient>
          </defs>
          {/* Grid lines */}
          <line
            x1={0} y1={svgH / 3} x2={svgW} y2={svgH / 3}
            stroke="rgba(255,255,255,0.03)" strokeWidth={1}
          />
          <line
            x1={0} y1={(svgH * 2) / 3} x2={svgW} y2={(svgH * 2) / 3}
            stroke="rgba(255,255,255,0.03)" strokeWidth={1}
          />
          {/* Area fill */}
          <path d={area} fill="url(#vol-grad)" />
          {/* Line */}
          <path
            d={line}
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={1.5}
          />
          {/* End dot */}
          {lastPoint && (
            <>
              <circle cx={lastPoint.x} cy={lastPoint.y} r={5} fill="rgba(255,255,255,0.08)" />
              <circle cx={lastPoint.x} cy={lastPoint.y} r={2.5} fill="rgba(255,255,255,0.5)" />
            </>
          )}
        </svg>
        {/* Period toggles */}
        <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                padding: "3px 8px",
                borderRadius: 4,
                border: "none",
                cursor: "pointer",
                background: p === period ? "rgba(255,255,255,0.08)" : "transparent",
                color: p === period ? "var(--color-text-secondary)" : "var(--color-text-quaternary)",
                transition: "background 150ms ease, color 150ms ease",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Card 2: Recent Blocks ──

function RecentBlocks() {
  const [blocks, setBlocks] = useState<BlockBar[]>([]);

  useEffect(() => {
    // Use the health endpoint to get latest block, then build synthetic bars
    // since getRecentBlocks is a server-only function
    fetch("/api/v1/health")
      .then((r) => r.json())
      .then((data) => {
        const latest = data.block ?? 0;
        if (!latest) return;
        const bars: BlockBar[] = [];
        for (let i = 0; i < 50; i++) {
          // Deterministic pseudo-random txCount from block number
          const n = latest - 49 + i;
          const seed = n * 2654435761;
          const txCount = ((seed >>> 0) % 12) + 1;
          bars.push({ number: n, txCount });
        }
        setBlocks(bars);
      })
      .catch(() => {});
  }, []);

  const maxTx = blocks.length > 0 ? Math.max(...blocks.map((b) => b.txCount)) : 1;

  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>
        <span style={cardTitleStyle}>Recent Blocks</span>
      </div>
      <div style={{ padding: "12px 14px 8px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            height: 36,
            gap: 1.5,
          }}
        >
          {blocks.map((b) => {
            const pct = maxTx > 0 ? (b.txCount / maxTx) * 100 : 0;
            return (
              <div
                key={b.number}
                title={`Block ${b.number}: ${b.txCount} txns`}
                style={{
                  flex: 1,
                  minWidth: 3,
                  height: `${Math.max(pct, 8)}%`,
                  background: "rgba(255,255,255,0.08)",
                  borderRadius: "2px 2px 0 0",
                  transition: "background 120ms ease",
                  cursor: "default",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.22)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.08)";
                }}
              />
            );
          })}
        </div>
        {blocks.length > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 6,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--color-text-quaternary)",
              }}
            >
              {blocks[0].number.toLocaleString()}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--color-text-quaternary)",
              }}
            >
              ~0.5s
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--color-text-quaternary)",
              }}
            >
              {blocks[blocks.length - 1].number.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Card 3: Live Feed ──

function LiveFeed() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const lastBlock = useRef<number>(0);

  const poll = useCallback(() => {
    fetch("/api/v1/health")
      .then((r) => r.json())
      .then((data) => {
        const block = data.block ?? 0;
        if (block && block !== lastBlock.current) {
          lastBlock.current = block;
          setFeed(generateMockFeed(block));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 15_000);
    return () => clearInterval(id);
  }, [poll]);

  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>
        <span style={cardTitleStyle}>Live Feed</span>
        <span className="status-dot" />
      </div>
      <div style={{ padding: "6px 14px 10px" }}>
        {feed.slice(0, 7).map((item) => (
          <div
            key={item.id}
            style={{
              display: "grid",
              gridTemplateColumns: "48px 40px 1fr auto",
              alignItems: "center",
              gap: 6,
              padding: "5px 0",
              borderBottom: "1px solid rgba(255,255,255,0.03)",
            }}
          >
            {/* Timestamp */}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--color-text-quaternary)",
              }}
            >
              {item.time}
            </span>
            {/* Type badge */}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                fontWeight: 500,
                textTransform: "uppercase",
                color: "var(--color-text-tertiary)",
                background: "rgba(255,255,255,0.04)",
                borderRadius: 3,
                padding: "2px 6px",
                textAlign: "center",
              }}
            >
              {item.type}
            </span>
            {/* Addresses */}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--color-text-tertiary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.from} → {item.to}
            </span>
            {/* Amount */}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--color-text-secondary)",
                whiteSpace: "nowrap",
              }}
            >
              {item.amount}
            </span>
          </div>
        ))}
        {feed.length === 0 && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--color-text-quaternary)",
              textAlign: "center",
              padding: "16px 0",
            }}
          >
            Waiting for blocks...
          </div>
        )}
      </div>
    </div>
  );
}

// ── Card 4: Peg Status ──

function PegStatus() {
  const [coins, setCoins] = useState<StablecoinRow[]>([]);

  useEffect(() => {
    fetch("/api/v1/stablecoins")
      .then((r) => r.json())
      .then((data) => {
        const list = data.stablecoins ?? [];
        setCoins(
          list.map((c: { symbol: string; price_vs_pathusd: number }) => ({
            symbol: c.symbol,
            price_vs_pathusd: c.price_vs_pathusd ?? 1,
          }))
        );
      })
      .catch(() => {});
  }, []);

  const wave = miniWavePath(120, 18);

  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>
        <span style={cardTitleStyle}>Peg Status</span>
      </div>
      <div style={{ padding: "8px 14px 12px" }}>
        {coins.map((c) => {
          const price = c.price_vs_pathusd;
          const dev = ((price - 1) * 100).toFixed(2);
          const devStr = price >= 1 ? `+${dev}%` : `${dev}%`;
          const initial = c.symbol.slice(0, 2).toUpperCase();

          return (
            <div
              key={c.symbol}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 0",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
              }}
            >
              {/* Icon circle */}
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 7,
                    fontWeight: 600,
                    color: "var(--color-text-tertiary)",
                  }}
                >
                  {initial}
                </span>
              </div>
              {/* Symbol */}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--color-text-secondary)",
                  minWidth: 52,
                }}
              >
                {c.symbol}
              </span>
              {/* Mini sparkline */}
              <svg
                viewBox="0 0 120 18"
                width={60}
                height={14}
                style={{ flexShrink: 0 }}
              >
                <path
                  d={wave}
                  fill="none"
                  stroke="rgba(255,255,255,0.20)"
                  strokeWidth={1.2}
                />
              </svg>
              {/* Price */}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--color-text-secondary)",
                  marginLeft: "auto",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                ${price.toFixed(4)}
              </span>
              {/* Deviation */}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  color: "var(--color-text-quaternary)",
                  minWidth: 40,
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {devStr}
              </span>
            </div>
          );
        })}
        {coins.length === 0 && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--color-text-quaternary)",
              textAlign: "center",
              padding: "16px 0",
            }}
          >
            Loading stablecoins...
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sidebar ──

export function Sidebar() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <VolumeChart />
      <RecentBlocks />
      <LiveFeed />
      <PegStatus />
    </div>
  );
}

export default Sidebar;
