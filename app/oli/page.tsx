import { dashboardSnapshot, tokenBreakdown } from "@/lib/oli/queries";
import { buildLabelMap } from "@/lib/oli/labelMap";
import { StatStrip } from "@/components/oli/StatStrip";
import { Leaderboard } from "@/components/oli/Leaderboard";
import { EventStream } from "@/components/oli/EventStream";
import { TokenStackChart } from "@/components/oli/TokenStackChart";
import { formatUsdcAmount } from "@/lib/oli/format";
import { TimeWindowToggle } from "@/components/oli/TimeWindowToggle";
import { windowHoursFromParam } from "@/lib/oli/timeWindow";

export const dynamic = "force-dynamic";

const WINDOW_LABELS: Record<number, string> = {
  24: "24h",
  168: "7d",
  720: "30d",
  8760: "all",
};

export default async function OliDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const params = await searchParams;
  const windowHours = windowHoursFromParam(params.w);
  const windowLabel = WINDOW_LABELS[windowHours];
  const [snap, labelMap, stack] = await Promise.all([
    dashboardSnapshot(windowHours),
    buildLabelMap(),
    tokenBreakdown(windowHours),
  ]);

  return (
    <div className="oli-page" style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1280 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div>
          <h1
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 36,
              fontWeight: 400,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Open-Ledger Interface{" "}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.32em",
                fontWeight: 400,
                color: "var(--color-text-quaternary)",
                letterSpacing: "0.06em",
                marginLeft: "0.35em",
                verticalAlign: "0",
              }}
            >
              (OLI)
            </span>
          </h1>
          <p style={{ color: "var(--color-text-tertiary)", marginTop: 6, fontSize: 13 }}>
            Autonomous economic activity on Tempo.
          </p>
        </div>
        <TimeWindowToggle current={windowHours} />
      </header>

      <StatStrip
        stats={[
          {
            label: `MPP txs · ${windowLabel}`,
            count: snap.txCount,
            valueType: "integer",
            hint: "decoded transfer events",
          },
          {
            label: `Agents active · ${windowLabel}`,
            count: snap.agentsActive,
            valueType: "integer",
            hint: "watched entities with ≥1 event",
          },
          {
            label: `Service revenue · ${windowLabel}`,
            count: Number(snap.amountSumWei),
            valueType: "usdc",
            hint: "sum of TIP-20 inflows",
          },
        ]}
      />

      <section>
        <h2
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--color-text-tertiary)",
            margin: "0 0 8px",
          }}
        >
          Service revenue by token · {windowLabel}
        </h2>
        <TokenStackChart points={stack.points} totals={stack.totals} bucketHours={stack.bucketHours} />
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Leaderboard
          title="Top services"
          rows={snap.topServices}
          hrefFor={(r) => `/oli/services/${r.id}`}
          cols={[
            { key: "label", header: "service", cell: (r) => r.label },
            { key: "rev", header: "revenue", align: "right", cell: (r) => formatUsdcAmount(r.amountSumWei, 6) },
            { key: "tx", header: "txs", align: "right", width: "60px", cell: (r) => r.txCount.toLocaleString() },
          ]}
        />
        <Leaderboard
          title="Top agents"
          rows={snap.topAgents}
          hrefFor={(r) => `/oli/agents/${r.id}`}
          cols={[
            { key: "label", header: "agent", cell: (r) => r.label },
            { key: "tx", header: "txs", align: "right", width: "80px", cell: (r) => r.txCount.toLocaleString() },
          ]}
        />
      </div>

      <section>
        <h2
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--color-text-tertiary)",
            margin: "0 0 8px",
          }}
        >
          Recent activity
        </h2>
        <EventStream events={snap.recentEvents} labelMap={labelMap} />
      </section>
    </div>
  );
}
