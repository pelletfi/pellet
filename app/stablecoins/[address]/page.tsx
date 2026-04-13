import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
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
        borderBottom: "1px solid #0f0f11",
        gap: "12px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          fontSize: "12px",
          color: "#555",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: mono ? "var(--font-geist-mono), monospace" : "var(--font-geist-sans)",
          fontSize: "12px",
          color: "#c4c4c4",
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
        background: "#13131a",
        border: "1px solid #1a1a1f",
        borderRadius: "10px",
        padding: "20px",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-geist-sans)",
          fontSize: "11px",
          fontWeight: 600,
          color: "#555",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: "14px",
          paddingBottom: "10px",
          borderBottom: "1px solid #1a1a1f",
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
      ? "#4ade80"
      : Math.abs(data.price_vs_pathusd - 1) < 0.005
      ? "#fbbf24"
      : "#f87171";

  return (
    <div style={{ minHeight: "100vh" }}>
      <Nav />

      <main
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "32px 24px",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <Link
            href="/stablecoins"
            style={{
              fontFamily: "var(--font-geist-sans)",
              fontSize: "12px",
              color: "#444",
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
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                fontSize: "24px",
                fontWeight: 600,
                color: "#f5f5f5",
                letterSpacing: "-0.02em",
              }}
            >
              {data.symbol}
            </h1>
            <span
              style={{
                fontFamily: "var(--font-geist-sans)",
                fontSize: "13px",
                color: "#555",
              }}
            >
              {data.name}
            </span>
          </div>

          <div
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: "12px",
              color: "#444",
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
              background: "#13131a",
              border: "1px solid #1a1a1f",
              borderRadius: "8px",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-geist-sans)",
                fontSize: "10px",
                color: "#444",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Price vs pathUSD
            </span>
            <span
              style={{
                fontFamily: "var(--font-geist-mono), monospace",
                fontSize: "24px",
                fontWeight: 600,
                color: pegColor,
              }}
            >
              {data.price_vs_pathusd.toFixed(6)}
            </span>
            <span
              style={{
                fontFamily: "var(--font-geist-mono), monospace",
                fontSize: "11px",
                color: "#444",
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
                  <span style={{ color: "#4ade80" }}>
                    {(data.yield_rate * 100).toFixed(2)}%
                  </span>
                ) : (
                  <span style={{ color: "#333" }}>—</span>
                )
              }
            />
            <DataRow label="Currency" value={data.currency} />
          </Card>
        </div>
      </main>
    </div>
  );
}
