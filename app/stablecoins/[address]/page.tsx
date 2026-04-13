import { notFound } from "next/navigation";
import { getStablecoinMetadata, KNOWN_STABLECOINS } from "@/lib/pipeline/stablecoins";
import Link from "next/link";

function formatSupply(raw: string, decimals = 6): string {
  const n = parseInt(raw, 10) / 10 ** decimals;
  if (isNaN(n)) return raw;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(3)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(3)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(3)}K`;
  return n.toFixed(6);
}

function truncate(addr: string): string {
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function DataRow({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        padding: "8px 0",
        borderBottom: "1px solid var(--color-border)",
        gap: "12px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: "12px",
          color: "var(--color-muted)",
          textTransform: "uppercase",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: mono ? "var(--font-mono), monospace" : "inherit",
          fontSize: "14px",
          color: "var(--color-text)",
          textAlign: "right",
          wordBreak: "break-all",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "8px",
        padding: "24px",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--color-muted)",
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          marginBottom: "14px",
          paddingBottom: "10px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

export default async function StablecoinDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;

  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    notFound();
  }

  // Look up in known stablecoins for name/symbol
  const known = KNOWN_STABLECOINS.find(
    (s) => s.address.toLowerCase() === address.toLowerCase()
  );

  if (!known) notFound();

  const data = await getStablecoinMetadata(
    address as `0x${string}`,
    known.name,
    known.symbol
  ).catch(() => null);

  if (!data) notFound();

  const pegColor =
    Math.abs(data.price_vs_pathusd - 1) < 0.001
      ? "var(--color-positive)"
      : Math.abs(data.price_vs_pathusd - 1) < 0.005
      ? "#d97706"
      : "var(--color-negative)";

  return (
    <main
      style={{
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "48px 24px",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <Link
          href="/stablecoins"
          style={{
            fontSize: "12px",
            color: "var(--color-secondary)",
            textDecoration: "none",
            display: "inline-block",
            marginBottom: "12px",
          }}
        >
          ← Stablecoins
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "var(--color-text)",
              letterSpacing: "-0.02em",
            }}
          >
            {data.symbol}
          </h1>
          <span
            style={{
              fontSize: "15px",
              color: "var(--color-secondary)",
            }}
          >
            {data.name}
          </span>
        </div>

        <div
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: "12px",
            color: "var(--color-muted)",
            marginBottom: "20px",
          }}
        >
          {address}
        </div>

        {/* Key stat: peg */}
        <div
          style={{
            display: "inline-flex",
            flexDirection: "column",
            gap: "4px",
            padding: "14px 20px",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: "10px",
              color: "var(--color-muted)",
              textTransform: "uppercase",
              letterSpacing: "1.5px",
            }}
          >
            Price vs pathUSD
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: "24px",
              fontWeight: 600,
              color: pegColor,
            }}
          >
            {data.price_vs_pathusd.toFixed(6)}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: "11px",
              color: "var(--color-muted)",
            }}
          >
            spread: {data.spread_bps > 0 ? `${data.spread_bps} bps` : "—"}
          </span>
        </div>
      </div>

      {/* 2-col grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
        }}
      >
        {/* Compliance */}
        <Card title="Compliance">
          <DataRow label="Policy ID" value={data.policy_id.toString()} />
          <DataRow label="Policy type" value={data.policy_type} />
          {data.policy_admin && (
            <DataRow label="Policy admin" value={truncate(data.policy_admin)} />
          )}
          <DataRow label="Currency" value={data.currency} />
        </Card>

        {/* Supply */}
        <Card title="Supply">
          <DataRow label="Current supply" value={formatSupply(data.current_supply)} />
          <DataRow
            label="Supply cap"
            value={data.supply_cap === "0" ? "uncapped" : formatSupply(data.supply_cap)}
          />
          <DataRow
            label="Headroom"
            value={
              data.headroom_pct === -1
                ? "uncapped"
                : `${data.headroom_pct.toFixed(2)}%`
            }
          />
          <DataRow label="Opted-in supply" value={formatSupply(data.opted_in_supply)} />
        </Card>

        {/* Market */}
        <Card title="Market">
          <DataRow
            label="Price vs pathUSD"
            value={
              <span style={{ color: pegColor }}>
                {data.price_vs_pathusd.toFixed(6)}
              </span>
            }
          />
          <DataRow
            label="Peg deviation"
            value={`${(Math.abs(data.price_vs_pathusd - 1) * 10000).toFixed(1)} bps`}
          />
          <DataRow
            label="Spread"
            value={data.spread_bps > 0 ? `${data.spread_bps} bps` : "—"}
          />
          <DataRow
            label="Volume 24h"
            value={data.volume_24h > 0 ? `$${data.volume_24h.toLocaleString()}` : "—"}
          />
        </Card>

        {/* Yield */}
        <Card title="Yield">
          <DataRow
            label="Yield rate"
            value={
              data.yield_rate > 0 ? (
                <span style={{ color: "var(--color-positive)" }}>
                  {(data.yield_rate * 100).toFixed(2)}%
                </span>
              ) : (
                <span style={{ color: "var(--color-muted)" }}>—</span>
              )
            }
          />
          <DataRow label="Currency" value={data.currency} />
        </Card>
      </div>
    </main>
  );
}
