import { providerDetail } from "@/lib/oli/queries";
import { buildLabelMap } from "@/lib/oli/labelMap";
import { TrendChart } from "@/components/oli/TrendChart";
import { EventStream } from "@/components/oli/EventStream";
import { shortAddress, formatUsdcAmount, formatTimeAgo } from "@/lib/oli/format";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OliProviderDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const addr = decodeURIComponent(address).toLowerCase();
  const [detail, labelMap] = await Promise.all([providerDetail(addr), buildLabelMap()]);

  if (!detail) notFound();

  const trendPoints = detail.trend.map((t) => ({
    ts: t.bucket,
    value: Number(t.amountWei) / 1_000_000,
  }));

  return (
    <div
      className="oli-page"
      style={{ padding: "32px 48px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 1024 }}
    >
      <header>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--color-text-quaternary)",
          }}
        >
          Routed provider · attributed via gateway
        </span>
        <h1
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 40,
            fontWeight: 400,
            margin: "4px 0 8px",
          }}
        >
          {detail.label ?? (
            <code style={{ fontFamily: "var(--font-mono)", fontSize: 28, color: "var(--color-accent)" }}>
              {detail.kind === "address" && detail.address
                ? shortAddress(detail.address)
                : `fp:${detail.fingerprint?.slice(0, 6)}…${detail.fingerprint?.slice(-4)}`}
            </code>
          )}
        </h1>
        <p
          style={{
            color: "var(--color-text-tertiary)",
            fontSize: 12,
            margin: 0,
            fontFamily: "var(--font-mono)",
          }}
        >
          {detail.kind === "address" && detail.address ? (
            <>
              <code>{detail.address}</code>
              {detail.category && ` · ${detail.category}`}
            </>
          ) : (
            <>
              <code>fingerprint 0x{detail.fingerprint}</code>
              {" · pattern-b grouping (provider not yet identified)"}
            </>
          )}
        </p>
        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(4, auto)",
            gap: 32,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--color-text-tertiary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <Stat label="Lifetime revenue" value={`$${formatUsdcAmount(detail.amountSumWei, 6)}`} />
          <Stat label="Lifetime txs" value={detail.txCount.toLocaleString()} />
          <Stat label="Revenue · 24h" value={`$${formatUsdcAmount(detail.amountSumWei24h, 6)}`} />
          <Stat label="Last seen" value={detail.lastSeen ? formatTimeAgo(detail.lastSeen) : "—"} />
        </div>
      </header>

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
          Revenue trend · 30 days
        </h2>
        <TrendChart points={trendPoints} formatY={(v) => `$${v.toFixed(2)}`} />
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
          Routed activity · last 50
        </h2>
        <EventStream events={detail.recent as never} labelMap={labelMap} />
      </section>

      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--color-text-quaternary)",
          letterSpacing: "0.04em",
        }}
      >
        attribution recovered from settlement event topic[2] · escrow 0x33b9…4f25
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ color: "var(--color-text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 9 }}>
        {label}
      </span>
      <span style={{ color: "var(--color-text-primary)", fontSize: 13 }}>{value}</span>
    </div>
  );
}
