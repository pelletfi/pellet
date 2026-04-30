import { dashboardSnapshot, tokenBreakdown } from "@/lib/oli/queries";
import { buildLabelMap } from "@/lib/oli/labelMap";
import { StatStrip } from "@/components/oli/StatStrip";
import { Leaderboard } from "@/components/oli/Leaderboard";
import { EventStream } from "@/components/oli/EventStream";
import { TokenStackChart } from "@/components/oli/TokenStackChart";
import { TxCountChart } from "@/components/oli/TxCountChart";
import { formatUsdcAmount, shortAddress } from "@/lib/oli/format";
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
    <div className="oli-page">
      <header className="oli-page-header">
        <div>
          <h1 className="oli-page-h1">
            Open-Ledger Interface{" "}
            <span className="oli-page-h1-em">(OLI)</span>
          </h1>
          <p style={{ color: "var(--color-text-tertiary)", marginTop: 6, fontSize: 13 }}>
            The open ledger of the agent economy.{" "}
            <a
              href="/oli/rails"
              style={{
                color: "var(--color-text-quaternary)",
                textDecoration: "none",
                borderBottom: "1px solid var(--color-border-subtle)",
              }}
            >
              Tempo today, more rails as they ship.
            </a>
          </p>
        </div>
        <TimeWindowToggle current={windowHours} />
      </header>

      <StatStrip
        stats={[
          {
            label: "MPP txs",
            count: snap.txCount,
            valueType: "integer",
            hint: "decoded transfer events",
          },
          {
            label: "Agents active",
            count: snap.agentsActive,
            valueType: "integer",
            hint: "watched entities with ≥1 event",
          },
          {
            label: "Service revenue",
            count: Number(snap.amountSumWei),
            valueType: "usdc",
            hint: "sum of TIP-20 inflows",
          },
          {
            label: "Providers detected",
            count: snap.providersDetected,
            valueType: "integer",
            hint: "distinct routed providers + fp groups",
          },
        ]}
      />

      <div className="oli-page-cols-2" style={{ gap: 16 }}>
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
            MPP txs · {windowLabel}
          </h2>
          <TxCountChart points={stack.points} bucketHours={stack.bucketHours} />
        </section>
      </div>

      <div className="oli-page-cols-2" style={{ gap: 16 }}>
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

      {snap.topProviders.length > 0 && (
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
            Top providers · routed via gateway · {windowLabel}
          </h2>
          <div className="oli-providers-table">
            <div className="oli-providers-row oli-providers-row-head">
              <span className="oli-providers-rank">#</span>
              <span className="oli-providers-addr">provider</span>
              <span className="oli-providers-num" data-cell="rev">revenue</span>
              <span className="oli-providers-num" data-cell="txs">txs</span>
              <span className="oli-providers-time">share</span>
            </div>
            {(() => {
              const total = snap.topProviders.reduce(
                (acc, p) => acc + Number(p.amountSumWei),
                0,
              );
              return snap.topProviders.map((p, i) => {
                const share = total > 0 ? (Number(p.amountSumWei) / total) * 100 : 0;
                const display = p.label
                  ? p.label
                  : p.kind === "address" && p.address
                  ? shortAddress(p.address)
                  : `fp:${p.fingerprint?.slice(0, 6)}…${p.fingerprint?.slice(-4)}`;
                return (
                  <a
                    key={p.key}
                    href={`/oli/providers/${p.key}`}
                    className="oli-providers-row oli-providers-row-link"
                  >
                    <span className="oli-providers-rank">{String(i + 1).padStart(2, "0")}</span>
                    <span className="oli-providers-addr">
                      {p.label ? (
                        <span className="oli-providers-addr-label">{display}</span>
                      ) : (
                        <code className="oli-providers-addr-hex">{display}</code>
                      )}
                    </span>
                    <span className="oli-providers-num" data-cell="rev">{formatUsdcAmount(p.amountSumWei, 6)}</span>
                    <span className="oli-providers-num" data-cell="txs">{p.txCount.toLocaleString()}</span>
                    <span className="oli-providers-time">{share.toFixed(1)}%</span>
                  </a>
                );
              });
            })()}
          </div>
        </section>
      )}

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
