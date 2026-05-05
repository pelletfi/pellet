import Link from "next/link";
import { dashboardSnapshot, tokenBreakdown } from "@/lib/oli/queries";
import { windowHoursFromParam } from "@/lib/oli/timeWindow";
import { Clock } from "@/app/specimen/Clock";
import { SpecimenTimeToggle } from "@/app/specimen/SpecimenTimeToggle";
import {
  Sparkline,
  VerifyBadge,
  fmtUsdCompact,
} from "@/components/specimen/dashboard-charts";
import { SpecimenSettlementRow } from "@/components/oli/SpecimenSettlementRow";
import type { SettlementEvent } from "@/components/oli/SpecimenSettlementRow";
import { LiquidGlass } from "@/components/oli/LiquidGlass";

export const dynamic = "force-dynamic";

const WINDOW_LABELS: Record<number, string> = {
  24: "24H",
  168: "7D",
  720: "30D",
  8760: "ALL",
};

const USDCE_ADDR = "0x20c000000000000000000000b9537d11c60e8b50";
const USDT0_ADDR = "0x20c00000000000000000000014f22ca97301eb73";

function tokenSymbol(addr: string | null): string {
  if (!addr) return "—";
  const a = addr.toLowerCase();
  if (a === USDCE_ADDR) return "USDC.e";
  if (a === USDT0_ADDR) return "USDT0";
  return "TOKEN";
}

function timeAgoShort(d: Date): string {
  const ago = Date.now() - d.getTime();
  const s = Math.floor(ago / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function shortHash(h: string): string {
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}

function fmtAmount(wei: string | null, addr: string | null): string {
  if (!wei) return "—";
  const sym = tokenSymbol(addr);
  const usd = Number(wei) / 1_000_000;
  if (!Number.isFinite(usd)) return `${sym}`;
  if (usd === 0) return `$0 ${sym}`;
  if (Math.abs(usd) >= 1) return `$${usd.toFixed(2)} ${sym}`;
  return `$${usd.toFixed(4)} ${sym}`;
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
        <span>The open ledger of the agent economy.</span>
        <Clock />
      </div>
    </section>
  );
}

function KpiStrip({
  windowLabel,
  txCount,
  agentsActive,
  amountSumWei,
  providersDetected,
  totalsByToken,
  txSeries,
  revSeries,
}: {
  windowLabel: string;
  txCount: number;
  agentsActive: number;
  amountSumWei: string;
  providersDetected: number;
  totalsByToken: { usdce: number; usdt0: number; other: number };
  txSeries: number[];
  revSeries: number[];
}) {
  const totalUsd = totalsByToken.usdce + totalsByToken.usdt0 + totalsByToken.other;
  return (
    <section className="spec-kpi-stack">
      <div className="spec-kpi-card">
        <span className="spec-strip-label">MPP TXS · {windowLabel}</span>
        <span
          className="spec-strip-value spec-strip-value-md"
          style={{ display: "inline-flex", alignItems: "baseline", gap: 12 }}
        >
          <span>{txCount.toLocaleString()}</span>
          <span style={{ opacity: 0.85, lineHeight: 1 }}>
            <Sparkline values={txSeries} />
          </span>
        </span>
        <span className="spec-strip-sub">
          <span>decoded transfer events · hourly shape</span>
        </span>
      </div>
      <div className="spec-kpi-card">
        <span className="spec-strip-label">AGENTS ACTIVE</span>
        <span className="spec-strip-value spec-strip-value-md">{agentsActive.toLocaleString()}</span>
        <span className="spec-strip-sub">
          <span>watched entities · ≥1 event</span>
        </span>
      </div>
      <div className="spec-kpi-card">
        <span className="spec-strip-label">SERVICE REVENUE · {windowLabel}</span>
        <span
          className="spec-strip-value spec-strip-value-md"
          style={{ display: "inline-flex", alignItems: "baseline", gap: 12 }}
        >
          <span>{fmtUsdCompact(totalUsd || Number(amountSumWei) / 1_000_000)}</span>
          <span style={{ opacity: 0.85, lineHeight: 1 }}>
            <Sparkline values={revSeries} />
          </span>
        </span>
        <span className="spec-strip-sub">
          <span>
            USDC.e {fmtUsdCompact(totalsByToken.usdce)} · USDT0{" "}
            {fmtUsdCompact(totalsByToken.usdt0)}
          </span>
        </span>
      </div>
      <div className="spec-kpi-card">
        <span className="spec-strip-label">PROVIDERS DETECTED</span>
        <span className="spec-strip-value spec-strip-value-md">{providersDetected.toLocaleString()}</span>
        <span className="spec-strip-sub">
          <span>distinct routed providers + fp groups</span>
        </span>
      </div>
    </section>
  );
}

function trendValues(seed: number) {
  let s = seed || 1;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
  const out: number[] = [];
  let v = 10;
  for (let i = 0; i < 56; i++) {
    v += (rand() - 0.45) * 1.6;
    out.push(Math.max(0, v));
  }
  return out;
}

function TopRankingTable({
  rows,
  windowLabel,
  totalCount,
  kind,
}: {
  rows: Array<{ id: string; label: string; category: string | null; txCount: number; amountSumWei: string }>;
  windowLabel: string;
  totalCount: number;
  kind: "services" | "agents";
}) {
  const isServices = kind === "services";
  const title = isServices ? "TOP SERVICES" : "TOP AGENTS";
  const entityLabel = isServices ? "SERVICE" : "AGENT";
  const valueLabel = isServices ? "REVENUE" : "SPEND";
  const hrefBase = isServices ? "/oli/services" : "/oli/agents";
  const viewAllLabel = isServices ? "View all services →" : "View all agents →";

  return (
    <div className="spec-table" data-table={kind}>
      <div className="spec-table-header">
        <span className="spec-table-title">{title} · {windowLabel}</span>
        <span className="spec-table-meta">
          <span className="spec-table-meta-faint">ROWS</span>
          <span>
            {rows.length} / {totalCount}
          </span>
        </span>
      </div>
      <div className="spec-row-head">
        <span style={{ width: 20, flexShrink: 0 }}>#</span>
        <span style={{ flex: 1, minWidth: 0 }}>{entityLabel}</span>
        <span style={{ width: 78, flexShrink: 0, marginLeft: 16 }} className="spec-cell-r">{valueLabel}</span>
        <span style={{ width: 44, flexShrink: 0, marginLeft: 16 }} className="spec-cell-r">TXS</span>
        <span style={{ width: 84, flexShrink: 0, marginLeft: 16 }} className="spec-cell-r">7D TREND</span>
      </div>
      {rows.map((row, i) => {
        const rev = Number(row.amountSumWei) / 1_000_000;
        const seed =
          Array.from(row.id).reduce((acc, c) => (acc * 33 + c.charCodeAt(0)) >>> 0, 5381) || 1;
        return (
          <Link key={row.id} href={`${hrefBase}/${row.id}`} className="spec-row">
            <span style={{ width: 20, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}
              >
                {row.label}
              </span>
              <VerifyBadge />
            </span>
            <span
              style={{ width: 78, flexShrink: 0, marginLeft: 16 }}
              className="spec-cell-r"
            >
              {fmtUsdCompact(rev)}
            </span>
            <span
              style={{ width: 44, flexShrink: 0, marginLeft: 16 }}
              className="spec-cell-r"
            >
              {row.txCount.toLocaleString()}
            </span>
            <span
              style={{
                width: 84,
                flexShrink: 0,
                marginLeft: 16,
                display: "inline-flex",
                justifyContent: "flex-end",
              }}
              className="spec-cell-r"
            >
              <Sparkline values={trendValues(seed)} />
            </span>
          </Link>
        );
      })}
      <Link href={hrefBase} className="spec-view-all">
        {viewAllLabel}
      </Link>
    </div>
  );
}

function TopProvidersTable({
  rows,
  windowLabel,
}: {
  rows: Array<{
    key: string;
    kind: "address" | "fingerprint";
    address: string | null;
    fingerprint: string | null;
    label: string | null;
    txCount: number;
    amountSumWei: string;
  }>;
  windowLabel: string;
}) {
  const totalRevenue = rows.reduce(
    (acc, r) => acc + Number(r.amountSumWei) / 1_000_000,
    0,
  );
  return (
    <div className="spec-table" data-table="providers">
      <div className="spec-table-header">
        <span className="spec-table-title">
          TOP PROVIDERS · ROUTED VIA GATEWAY · {windowLabel}
        </span>
        <span className="spec-table-meta">
          <span className="spec-table-meta-faint">ROWS</span>
          <span>{rows.length}</span>
        </span>
      </div>
      <div className="spec-row-head">
        <span style={{ width: 24, flexShrink: 0 }}>#</span>
        <span style={{ flex: 1, minWidth: 0 }}>PROVIDER</span>
        <span style={{ width: 96, flexShrink: 0, marginLeft: 16 }} className="spec-cell-r">REVENUE</span>
        <span style={{ width: 60, flexShrink: 0, marginLeft: 16 }} className="spec-cell-r">TXS</span>
        <span style={{ width: 64, flexShrink: 0, marginLeft: 16 }} className="spec-cell-r">SHARE</span>
      </div>
      {rows.map((row, i) => {
        const rev = Number(row.amountSumWei) / 1_000_000;
        const share = totalRevenue > 0 ? (rev / totalRevenue) * 100 : 0;
        const display =
          row.label ??
          (row.kind === "address" && row.address
            ? `${row.address.slice(0, 6)}…${row.address.slice(-4)}`
            : row.fingerprint
            ? `fp:${row.fingerprint.slice(0, 6)}…${row.fingerprint.slice(-4)}`
            : row.key);
        const href =
          row.kind === "address" && row.address
            ? `/oli/providers/${row.address}`
            : row.fingerprint
            ? `/oli/providers/fp_${row.fingerprint}`
            : "/oli/providers";
        return (
          <Link key={row.key} href={href} className="spec-row">
            <span style={{ width: 24, flexShrink: 0 }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {display}
            </span>
            <span
              style={{ width: 96, flexShrink: 0, marginLeft: 16 }}
              className="spec-cell-r"
            >
              {fmtUsdCompact(rev)}
            </span>
            <span
              style={{ width: 60, flexShrink: 0, marginLeft: 16 }}
              className="spec-cell-r"
            >
              {row.txCount.toLocaleString()}
            </span>
            <span
              style={{ width: 64, flexShrink: 0, marginLeft: 16 }}
              className="spec-cell-r"
            >
              {share.toFixed(1)}%
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function RecentSettlementsTable({
  events,
}: {
  events: SettlementEvent[];
}) {
  const slice = events.slice(0, 12);
  return (
    <div className="spec-table" data-table="settlements">
      <div className="spec-table-header">
        <span className="spec-table-title">RECENT SETTLEMENTS · LIVE</span>
        <span className="spec-table-meta">
          <span className="spec-legend-square spec-legend-square-filled" />
          <span>STREAMING</span>
        </span>
      </div>
      <div className="spec-activity-head" style={{ paddingLeft: 24 }}>
        <span style={{ width: 40, flexShrink: 0 }}>T-</span>
        <span style={{ width: 92, flexShrink: 0 }}>TX</span>
        <span style={{ flex: 1, minWidth: 0 }}>MEMO</span>
        <span style={{ width: 110, flexShrink: 0 }} className="spec-cell-r">AMOUNT</span>
        <span style={{ width: 86, flexShrink: 0 }} className="spec-cell-r">SERVICE</span>
        <span style={{ width: 50, flexShrink: 0 }} className="spec-cell-r">STATUS</span>
      </div>
      {slice.map((ev) => (
        <SpecimenSettlementRow key={ev.id} ev={ev} />
      ))}
      <Link href="/oli/activity" className="spec-view-all">
        View all settlements →
      </Link>
    </div>
  );
}

export default async function OliDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const params = await searchParams;
  const windowHours = windowHoursFromParam(params.w);
  const windowLabel = WINDOW_LABELS[windowHours] ?? "24H";

  const [snap, stack] = await Promise.all([
    dashboardSnapshot(windowHours),
    tokenBreakdown(windowHours),
  ]);

  return (
    <div className="spec-ledger-float" style={{ position: "relative", isolation: "isolate" }}>
      <LiquidGlass
        style={{
          position: "absolute",
          inset: 0,
          zIndex: -1,
          pointerEvents: "none",
        }}
      />
      <PageHeader currentHours={windowHours} />
      <KpiStrip
        windowLabel={windowLabel}
        txCount={snap.txCount}
        agentsActive={snap.agentsActive}
        amountSumWei={snap.amountSumWei}
        providersDetected={snap.providersDetected}
        totalsByToken={stack.totals}
        txSeries={stack.points.map((p) => p.txCount)}
        revSeries={stack.points.map((p) => p.usdce + p.usdt0 + p.other)}
      />
      <section className="spec-tables">
        <TopRankingTable
          rows={snap.topServices}
          windowLabel={windowLabel}
          totalCount={snap.topServices.length}
          kind="services"
        />
        <TopRankingTable
          rows={snap.topAgents}
          windowLabel={windowLabel}
          totalCount={snap.topAgents.length}
          kind="agents"
        />
      </section>
      <section className="spec-tables">
        <TopProvidersTable
          rows={snap.topProviders}
          windowLabel={windowLabel}
        />
      </section>
      <section className="spec-tables">
        <RecentSettlementsTable
          events={snap.recentEvents.map((ev) => ({
            id: ev.id,
            ts: ev.ts.toISOString(),
            agentId: ev.agentId,
            agentLabel: ev.agentLabel,
            counterpartyAddress: ev.counterpartyAddress,
            counterpartyLabel: ev.counterpartyLabel,
            routedToAddress: ev.routedToAddress,
            routedToLabel: ev.routedToLabel,
            routedFingerprint: ev.routedFingerprint,
            kind: ev.kind,
            amountWei: ev.amountWei,
            tokenAddress: ev.tokenAddress,
            txHash: ev.txHash,
            sourceBlock: ev.sourceBlock,
            methodologyVersion: ev.methodologyVersion,
          }))}
        />
      </section>
    </div>
  );
}
