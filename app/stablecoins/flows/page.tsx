import { getStablecoinFlows, KNOWN_STABLECOINS } from "@/lib/pipeline/stablecoins";
import Link from "next/link";

function formatUsd(value: number): string {
  if (value === 0) return "$0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function labelForAddress(address: string): string {
  const found = KNOWN_STABLECOINS.find(
    (s) => s.address.toLowerCase() === address.toLowerCase()
  );
  return found?.symbol ?? `${address.slice(0, 6)}…${address.slice(-4)}`;
}

interface SearchParams {
  hours?: string;
}

export default async function StablecoinFlowsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const hours = Math.max(1, Math.min(168, parseInt(params.hours ?? "24", 10)));

  const flows = await getStablecoinFlows(hours).catch(() => []);

  // Aggregate by from/to pair (sum across hours)
  const pairMap = new Map<string, { from: string; to: string; usd: number; txCount: number }>();
  for (const flow of flows) {
    if (flow.from_token === "unknown" || flow.to_token === "unknown") continue;
    const key = `${flow.from_token}:${flow.to_token}`;
    const existing = pairMap.get(key);
    if (existing) {
      existing.usd += flow.net_flow_usd;
      existing.txCount += flow.tx_count;
    } else {
      pairMap.set(key, {
        from: flow.from_token,
        to: flow.to_token,
        usd: flow.net_flow_usd,
        txCount: flow.tx_count,
      });
    }
  }

  const aggregated = Array.from(pairMap.values()).sort((a, b) => b.usd - a.usd);

  const HOUR_OPTIONS = [1, 6, 24, 48, 168];

  return (
    <main
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        padding: "48px 24px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
        <div>
          <div style={{ marginBottom: "8px" }}>
            <Link
              href="/stablecoins"
              style={{
                fontSize: "12px",
                color: "var(--color-secondary)",
                textDecoration: "none",
              }}
            >
              ← Stablecoins
            </Link>
          </div>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "var(--color-text)",
              letterSpacing: "-0.02em",
              marginBottom: "4px",
            }}
          >
            Flow Matrix
          </h1>
          <p
            style={{
              fontSize: "15px",
              color: "var(--color-secondary)",
            }}
          >
            DEX flows between stablecoins — last {hours}h
          </p>
        </div>

        {/* Time selector */}
        <div style={{ display: "flex", gap: "4px" }}>
          {HOUR_OPTIONS.map((h) => (
            <a
              key={h}
              href={`/stablecoins/flows?hours=${h}`}
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: "12px",
                color: h === hours ? "#fff" : "var(--color-secondary)",
                textDecoration: "none",
                padding: "5px 10px",
                border: `1px solid ${h === hours ? "var(--color-text)" : "var(--color-border)"}`,
                background: h === hours ? "var(--color-text)" : "var(--color-surface)",
                borderRadius: "5px",
                transition: "border-color 0.15s",
              }}
            >
              {h >= 168 ? "7d" : h >= 48 ? "2d" : `${h}h`}
            </a>
          ))}
        </div>
      </div>

      {/* Flow table */}
      <div
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "10px",
          overflow: "hidden",
        }}
      >
        {/* Column headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 140px 80px",
            padding: "10px 16px",
            background: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)",
            gap: "8px",
          }}
        >
          {["From", "To", "Net Flow USD", "Tx Count"].map((h, i) => (
            <span
              key={h}
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: "10px",
                fontWeight: 500,
                color: "var(--color-muted)",
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                textAlign: i >= 2 ? "right" : "left",
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {aggregated.length === 0 ? (
          <div
            style={{
              padding: "40px 16px",
              textAlign: "center",
              fontSize: "14px",
              color: "var(--color-secondary)",
            }}
          >
            No flow data for this period.
          </div>
        ) : (
          aggregated.map((row) => (
            <div
              key={`${row.from}:${row.to}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 140px 80px",
                padding: "12px 16px",
                borderBottom: "1px solid var(--color-border)",
                gap: "8px",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: "13px",
                  color: "var(--color-text)",
                }}
              >
                {labelForAddress(row.from)}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: "13px",
                  color: "var(--color-text)",
                }}
              >
                {labelForAddress(row.to)}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: "13px",
                  color: row.usd >= 0 ? "var(--color-positive)" : "var(--color-negative)",
                  textAlign: "right",
                }}
              >
                {formatUsd(row.usd)}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: "12px",
                  color: "var(--color-muted)",
                  textAlign: "right",
                }}
              >
                {row.txCount.toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
