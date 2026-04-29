import { serviceDetail } from "@/lib/oli/queries";
import { buildLabelMap } from "@/lib/oli/labelMap";
import { TrendChart } from "@/components/oli/TrendChart";
import { EventStream } from "@/components/oli/EventStream";
import { shortAddress, formatUsdcAmount, formatTimeAgo } from "@/lib/oli/format";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OliServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, labelMap] = await Promise.all([
    serviceDetail(id),
    buildLabelMap(),
  ]);

  if (!detail.head) notFound();

  const trendPoints = detail.trend.map((t) => ({
    ts: new Date(t.bucket),
    value: Number(t.amountWei) / 1_000_000, // USDC.e (6 decimals)
  }));

  return (
    <div className="oli-page" style={{ padding: "32px 48px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 1024 }}>
      <header>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-quaternary)" }}>
          MPP Service
        </span>
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 40, fontWeight: 400, margin: "4px 0 8px" }}>
          {detail.head.label}
        </h1>
        <p style={{ color: "var(--color-text-tertiary)", fontSize: 13, margin: 0 }}>
          {detail.head.bio ?? ""}
        </p>
        <div style={{ marginTop: 12, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-tertiary)" }}>
          settlement <code>{shortAddress(detail.head.wallets?.[0] ?? "")}</code>
        </div>
      </header>

      <section>
        <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-tertiary)", margin: "0 0 8px" }}>
          Revenue trend · 30 days
        </h2>
        <TrendChart
          points={trendPoints}
          formatY={(v) => `$${v.toFixed(2)}`}
        />
      </section>

      {detail.providers.length > 0 && (
        <section>
          <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-tertiary)", margin: "0 0 8px" }}>
            Underlying providers · attributed on-chain
          </h2>
          <div className="oli-providers-table">
            <div className="oli-providers-row oli-providers-row-head">
              <span className="oli-providers-rank">#</span>
              <span className="oli-providers-addr">provider</span>
              <span className="oli-providers-num">revenue</span>
              <span className="oli-providers-num">txs</span>
              <span className="oli-providers-time">last</span>
            </div>
            {detail.providers.map((p, i) => (
              <a
                key={p.key}
                href={`/oli/providers/${p.key}`}
                className="oli-providers-row oli-providers-row-link"
              >
                <span className="oli-providers-rank">{String(i + 1).padStart(2, "0")}</span>
                <span className="oli-providers-addr">
                  {(() => {
                    const display = p.label
                      ? p.label
                      : p.kind === "address" && p.address
                      ? shortAddress(p.address)
                      : `fp:${p.fingerprint?.slice(0, 6)}…${p.fingerprint?.slice(-4)}`;
                    return p.label ? (
                      <span className="oli-providers-addr-label">{display}</span>
                    ) : (
                      <code className="oli-providers-addr-hex">{display}</code>
                    );
                  })()}
                </span>
                <span className="oli-providers-num">${formatUsdcAmount(p.amountSumWei, 6)}</span>
                <span className="oli-providers-num">{p.txCount.toLocaleString()}</span>
                <span className="oli-providers-time">{formatTimeAgo(p.lastTs)}</span>
              </a>
            ))}
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-quaternary)", marginTop: 8, letterSpacing: "0.04em" }}>
            recovered from settlement event topic[2] · escrow 0x33b9…4f25
          </p>
        </section>
      )}

      <section>
        <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-tertiary)", margin: "0 0 8px" }}>
          Recent activity
        </h2>
        <EventStream events={detail.recent as never} labelMap={labelMap} />
      </section>
    </div>
  );
}
