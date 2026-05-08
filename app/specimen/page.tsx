import type { Metadata } from "next";
import { Clock } from "./Clock";
import { SpecimenTimeToggle } from "./SpecimenTimeToggle";
import { tokenBreakdown, type TokenStackPoint, type TokenStackTotals } from "@/lib/wallet/queries";
import { windowHoursFromParam } from "@/lib/wallet/timeWindow";

export const metadata: Metadata = {
  title: "Specimen / Dashboard",
};

export const dynamic = "force-dynamic";

const WINDOW_LABELS: Record<number, string> = {
  24: "24H",
  168: "7D",
  720: "30D",
  8760: "ALL",
};

const CHART_AREA_PX = 196;

function fmtUsdCompact(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
}

function fmtUsdExact(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtIntCompact(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / pow;
  const stepped = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return stepped * pow;
}

function deriveBars(values: number[]): { bars: number[]; peak: number; yMax: number } {
  const peak = values.reduce((a, b) => (b > a ? b : a), 0);
  const yMax = niceCeil(peak);
  const bars =
    yMax === 0
      ? values.map(() => 0)
      : values.map((v) => Math.max(v > 0 ? 1 : 0, Math.round((v / yMax) * CHART_AREA_PX)));
  return { bars, peak, yMax };
}

function pickXTicks(points: TokenStackPoint[], bucketHours: number): string[] {
  if (points.length === 0) return [];
  const count = 7;
  const ticks: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i * (points.length - 1)) / (count - 1));
    const d = points[idx]!.bucket;
    if (bucketHours <= 1) {
      const h = String(d.getUTCHours()).padStart(2, "0");
      ticks.push(`${h}:00`);
    } else {
      ticks.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }));
    }
  }
  return ticks;
}

// 7-day trend, 4 buckets/hour ≈ 168 points feels overkill in a 56px slot;
// use 56 points so we get sub-pixel detail without aliasing.
function genTrend(seed: number, base: number, drift: number): number[] {
  // Deterministic LCG so the lines stay stable across renders.
  let s = seed;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < 56; i++) {
    // mean-reverting drift + small noise + per-step trend
    const noise = (rand() - 0.5) * (base * 0.18);
    const trend = (drift / 56) * (i - 28);
    const revert = (base - v) * 0.08;
    v = v + noise + revert + trend * 0.04;
    out.push(v);
  }
  return out;
}

const TOP_SERVICES = [
  { rank: "01", name: "Tempo MPP Gateway", category: "gateway", rev: "$18,742", txs: "2,134", agents: "28", trend: genTrend(11, 16, 9),  delta: "+11.3%", deltaUp: true },
  { rank: "02", name: "Codex",             category: "ai · llm", rev: "$3,118",  txs: "387",   agents: "14", trend: genTrend(73, 12, 4),  delta: "+6.7%",  deltaUp: true },
  { rank: "03", name: "Stargate USDC",     category: "bridge",   rev: "$1,041",  txs: "122",   agents: "9",  trend: genTrend(41, 13, 2),  delta: "+3.9%",  deltaUp: true },
  { rank: "04", name: "Enshrined DEX",     category: "dex",      rev: "$364",    txs: "29",    agents: "6",  trend: genTrend(29, 12, 1),  delta: "+2.2%",  deltaUp: true },
  { rank: "05", name: "Tether USDT0",      category: "stable",   rev: "$153",    txs: "11",    agents: "3",  trend: genTrend(7,  11, 0),  delta: "+1.1%",  deltaUp: true },
];

const RECENT_SETTLEMENTS = [
  { t: "02s", tx: "0xa14e…7c2b", memo: "x402:codex/run-9e2…",   amount: "$0.014 USDC.e", service: "Codex" },
  { t: "04s", tx: "0x77b9…3140", memo: "mpp:gateway/route/8…",  amount: "$2.41 USDC.e",  service: "MPP Gateway" },
  { t: "07s", tx: "0xc302…ab14", memo: "x402:stargate/swap-…",  amount: "$8.75 USDC.e",  service: "Stargate" },
  { t: "11s", tx: "0x9eb6…dd02", memo: "x402:codex/run-2c1…",   amount: "$0.022 USDC.e", service: "Codex" },
  { t: "14s", tx: "0x4f1a…6e98", memo: "mpp:gateway/route/8…",  amount: "$1.06 USDT0",   service: "MPP Gateway" },
];

function VerifyBadge() {
  return (
    <svg className="spec-verify" width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
      <circle cx="5.5" cy="5.5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M3.4 5.6 L4.8 7 L7.6 4" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 70;
  const h = 16;
  const pad = 1.5; // keep stroke off the top/bottom edge
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = w / (values.length - 1);
  const pts = values.map((v, i) => [
    i * stepX,
    pad + (h - pad * 2) - ((v - min) / span) * (h - pad * 2),
  ]) as Array<[number, number]>;

  // Catmull-Rom → cubic Bézier. Tension 0.5 reads as a clean editorial sparkline.
  const t = 0.5;
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) * (t / 3);
    const c1y = p1[1] + (p2[1] - p0[1]) * (t / 3);
    const c2x = p2[0] - (p3[0] - p1[0]) * (t / 3);
    const c2y = p2[1] - (p3[1] - p1[1]) * (t / 3);
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }

  return (
    <svg
      className="spec-spark"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function PageHeader({ currentHours }: { currentHours: number }) {
  return (
    <section className="spec-page-header">
      <div className="spec-page-header-row">
        <h1 className="spec-page-title">
          <span>01</span>
          <span>Ledger</span>
        </h1>
        <SpecimenTimeToggle current={currentHours} />
      </div>
      <div className="spec-page-subhead">
        <span>The wallet that connects to your AI.</span>
        <span className="spec-page-subhead-dot">·</span>
        <Clock />
      </div>
    </section>
  );
}

function KpiStrip() {
  return (
    <section className="spec-strip">
      <div className="spec-strip-cell">
        <span className="spec-strip-label">MPP TXS · 24H</span>
        <span className="spec-strip-value">2,745</span>
        <span className="spec-strip-sub">
          <span>+412 (+17.6%) vs prev 24h</span>
          <span className="spec-strip-sub-faint">peak 11:00 · 318/h</span>
        </span>
      </div>
      <div className="spec-strip-cell">
        <span className="spec-strip-label">AGENTS ACTIVE</span>
        <span className="spec-strip-value">38</span>
        <span className="spec-strip-sub">
          <span>+4 new since 04-29</span>
          <span className="spec-strip-sub-faint">≥1 settlement event</span>
        </span>
      </div>
      <div className="spec-strip-cell">
        <span className="spec-strip-label">SERVICE REVENUE · 24H</span>
        <span className="spec-strip-value">$23,418.07</span>
        <span className="spec-strip-sub">
          <span>USDC.e $22,118 · USDT0 $1,300</span>
        </span>
      </div>
      <div className="spec-strip-cell">
        <span className="spec-strip-label">PROVIDERS DETECTED</span>
        <span className="spec-strip-value">17</span>
        <span className="spec-strip-sub">
          <span>distinct routed providers + fp groups</span>
        </span>
      </div>
    </section>
  );
}

function RevenueChart({
  points,
  totals,
  xTicks,
  windowLabel,
}: {
  points: TokenStackPoint[];
  totals: TokenStackTotals;
  xTicks: string[];
  windowLabel: string;
}) {
  const perBucket = points.map((p) => p.usdce + p.usdt0 + p.other);
  const { bars, peak, yMax } = deriveBars(perBucket);
  const totalTx = points.reduce((acc, p) => acc + p.txCount, 0);
  return (
    <div className="spec-chart">
      <div className="spec-ticker">
        <div className="spec-ticker-left">
          <span className="spec-ticker-label">SERVICE REVENUE BY TOKEN · {windowLabel}</span>
          <span className="spec-ticker-legend">
            <span className="spec-legend-square spec-legend-square-outline" />
            <span>USDC.e {fmtUsdExact(totals.usdce)}</span>
          </span>
          <span className="spec-ticker-legend">
            <span className="spec-legend-square spec-legend-square-filled" />
            <span>USDT0 {fmtUsdExact(totals.usdt0)}</span>
          </span>
          <span className="spec-ticker-legend">
            <span className="spec-legend-square spec-legend-square-stripe" />
            <span>OTHER {fmtUsdExact(totals.other)}</span>
          </span>
        </div>
        <div className="spec-ticker-right">
          <span className="spec-ticker-pair">
            <span className="spec-ticker-label" style={{ opacity: 0.55 }}>TXS</span>
            <span>{totalTx.toLocaleString()}</span>
          </span>
          <span className="spec-ticker-pair">
            <span className="spec-ticker-label">PEAK/BKT</span>
            <span>{fmtUsdExact(peak)}</span>
          </span>
        </div>
      </div>
      <div className="spec-chart-body">
        <div className="spec-chart-area-row">
          <div className="spec-chart-y">
            <span>{fmtUsdCompact(yMax)}</span>
            <span>{fmtUsdCompact(yMax / 2)}</span>
            <span>$0</span>
          </div>
          <div className="spec-chart-area">
            {bars.map((h, i) => (
              <span key={i} className="spec-bar" style={{ height: `${h}px` }} />
            ))}
          </div>
        </div>
        <div className="spec-chart-x">
          {xTicks.map((t, i) => <span key={i}>{t}</span>)}
        </div>
      </div>
    </div>
  );
}

function TxChart({
  points,
  bucketHours,
  xTicks,
  windowLabel,
}: {
  points: TokenStackPoint[];
  bucketHours: number;
  xTicks: string[];
  windowLabel: string;
}) {
  const perBucket = points.map((p) => p.txCount);
  const { bars, peak, yMax } = deriveBars(perBucket);
  const total = perBucket.reduce((a, b) => a + b, 0);
  const granularity = bucketHours <= 1 ? "HOURLY" : bucketHours <= 6 ? "6H" : "DAILY";
  return (
    <div className="spec-chart">
      <div className="spec-ticker">
        <div className="spec-ticker-left">
          <span className="spec-ticker-label">MPP TXS · {windowLabel} · {granularity}</span>
        </div>
        <div className="spec-ticker-right">
          <span className="spec-ticker-pair">
            <span className="spec-ticker-label">TOTAL</span>
            <span>{total.toLocaleString()}</span>
          </span>
          <span className="spec-ticker-pair">
            <span className="spec-ticker-label">PEAK/BKT</span>
            <span>{peak.toLocaleString()}</span>
          </span>
          <span className="spec-ticker-pair">
            <span className="spec-ticker-label">BUCKETS</span>
            <span>{points.length}</span>
          </span>
        </div>
      </div>
      <div className="spec-chart-body">
        <div className="spec-chart-area-row">
          <div className="spec-chart-y">
            <span>{fmtIntCompact(yMax)}</span>
            <span>{fmtIntCompact(yMax / 2)}</span>
            <span>0</span>
          </div>
          <div className="spec-chart-area">
            {bars.map((h, i) => (
              <span key={i} className="spec-bar" style={{ height: `${h}px` }} />
            ))}
          </div>
        </div>
        <div className="spec-chart-x">
          {xTicks.map((t, i) => <span key={i}>{t}</span>)}
        </div>
      </div>
    </div>
  );
}

function ChartsRow({
  points,
  totals,
  bucketHours,
  windowLabel,
}: {
  points: TokenStackPoint[];
  totals: TokenStackTotals;
  bucketHours: number;
  windowLabel: string;
}) {
  const xTicks = pickXTicks(points, bucketHours);
  return (
    <section className="spec-charts">
      <RevenueChart points={points} totals={totals} xTicks={xTicks} windowLabel={windowLabel} />
      <TxChart points={points} bucketHours={bucketHours} xTicks={xTicks} windowLabel={windowLabel} />
    </section>
  );
}

function TopServicesTable() {
  return (
    <div className="spec-table" data-table="services">
      <div className="spec-table-header">
        <span className="spec-table-title">TOP SERVICES · 24H</span>
        <span className="spec-table-meta">
          <span className="spec-table-meta-faint">ROWS</span>
          <span>5 / 38</span>
        </span>
      </div>
      <div className="spec-row-head">
        <span style={{ width: 20, flexShrink: 0 }}>#</span>
        <span style={{ flex: 1, minWidth: 0 }}>SERVICE</span>
        <span style={{ width: 70, flexShrink: 0 }} className="spec-cell-r">CATEGORY</span>
        <span style={{ width: 78, flexShrink: 0, marginLeft: 24 }} className="spec-cell-r">REV · 24H</span>
        <span style={{ width: 44, flexShrink: 0, marginLeft: 24 }} className="spec-cell-r">TXS</span>
        <span style={{ width: 56, flexShrink: 0, marginLeft: 24, textAlign: "center" }}>AGENTS</span>
        <span style={{ width: 84, flexShrink: 0, marginLeft: 24 }} className="spec-cell-r">7D TREND</span>
        <span style={{ width: 56, flexShrink: 0, marginLeft: 16 }} className="spec-cell-r">Δ vs 7D</span>
      </div>
      {TOP_SERVICES.map((row) => (
        <div key={row.rank} className="spec-row">
          <span style={{ width: 20, flexShrink: 0 }}>{row.rank}</span>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{row.name}</span>
            <VerifyBadge />
          </span>
          <span style={{ width: 70, flexShrink: 0, opacity: 0.7 }} className="spec-cell-r">{row.category}</span>
          <span style={{ width: 78, flexShrink: 0, marginLeft: 24 }} className="spec-cell-r">{row.rev}</span>
          <span style={{ width: 44, flexShrink: 0, marginLeft: 24 }} className="spec-cell-r">{row.txs}</span>
          <span style={{ width: 56, flexShrink: 0, marginLeft: 24, textAlign: "center" }}>{row.agents}</span>
          <span style={{ width: 84, flexShrink: 0, marginLeft: 24, display: "inline-flex", justifyContent: "flex-end" }} className="spec-cell-r">
            <Sparkline values={row.trend} />
          </span>
          <span style={{ width: 56, flexShrink: 0, marginLeft: 16 }} className="spec-cell-r">
            <span className="spec-delta">{row.deltaUp ? "↗" : "↘"} {row.delta}</span>
          </span>
        </div>
      ))}
      <a href="#" className="spec-view-all">View all services →</a>
    </div>
  );
}

function RecentSettlementsTable() {
  return (
    <div className="spec-table" data-table="settlements">
      <div className="spec-table-header">
        <span className="spec-table-title">RECENT SETTLEMENTS · LIVE</span>
        <span className="spec-table-meta">
          <span className="spec-legend-square spec-legend-square-filled" />
          <span>STREAMING</span>
        </span>
      </div>
      <div className="spec-row-head">
        <span style={{ width: 40, flexShrink: 0 }}>T-</span>
        <span style={{ width: 92, flexShrink: 0 }}>TX</span>
        <span style={{ flex: 1, minWidth: 0 }}>MEMO</span>
        <span style={{ width: 92, flexShrink: 0 }} className="spec-cell-r">AMOUNT</span>
        <span style={{ width: 86, flexShrink: 0 }} className="spec-cell-r">SERVICE</span>
        <span style={{ width: 50, flexShrink: 0 }} className="spec-cell-r">STATUS</span>
      </div>
      {RECENT_SETTLEMENTS.map((row, i) => (
        <div key={i} className="spec-row">
          <span style={{ width: 40, flexShrink: 0 }}>{row.t}</span>
          <span style={{ width: 92, flexShrink: 0 }}>{row.tx}</span>
          <span style={{ flex: 1, minWidth: 0, opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.memo}</span>
          <span style={{ width: 92, flexShrink: 0 }} className="spec-cell-r">{row.amount}</span>
          <span style={{ width: 86, flexShrink: 0 }} className="spec-cell-r">{row.service}</span>
          <span style={{ width: 50, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }} className="spec-cell-r">
            <span className="spec-status-dot-sm" aria-hidden="true" />
            <span>OK</span>
          </span>
        </div>
      ))}
      <a href="#" className="spec-view-all">View all settlements →</a>
    </div>
  );
}

function TablesRow() {
  return (
    <section className="spec-tables">
      <TopServicesTable />
      <RecentSettlementsTable />
    </section>
  );
}

export default async function SpecimenDashboard({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const params = await searchParams;
  const windowHours = windowHoursFromParam(params.w);
  const windowLabel = WINDOW_LABELS[windowHours] ?? "24H";
  const stack = await tokenBreakdown(windowHours);
  return (
    <>
      <PageHeader currentHours={windowHours} />
      <KpiStrip />
      <ChartsRow
        points={stack.points}
        totals={stack.totals}
        bucketHours={stack.bucketHours}
        windowLabel={windowLabel}
      />
      <TablesRow />
    </>
  );
}
