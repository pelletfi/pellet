import type { Metadata } from "next";
import { getAllStablecoins } from "@/lib/pipeline/stablecoins";
import { getLatestBlockNumber } from "@/lib/explorer";
import { ExplorerSearch } from "./ExplorerSearch";
import { StablecoinFlows } from "./StablecoinFlows";
import { Sidebar } from "./Sidebar";
import { QuoteTokenTree } from "./QuoteTokenTree";
import { SupplyDistribution } from "./SupplyDistribution";
import StablecoinsTable from "./TokenTable";

export const metadata: Metadata = {
  title: "Explorer — Pellet",
  description:
    "Tempo stablecoin explorer. Search stablecoins, addresses, transactions, and blocks.",
};

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n > 0) return `$${n.toFixed(0)}`;
  return "$0";
}

export default async function ExplorerPage() {
  // Parallel data fetching — stablecoins + block height
  const [stablecoins, blockHeight] = await Promise.all([
    getAllStablecoins().catch(() => []),
    getLatestBlockNumber().catch(() => 0),
  ]);

  // Aggregate stablecoin stats
  const totalVolume = stablecoins.reduce((sum, s) => sum + (s.volume_24h ?? 0), 0);
  const totalSupply = stablecoins.reduce((sum, s) => {
    const n = parseFloat(s.current_supply ?? "0");
    return sum + (isFinite(n) ? n : 0);
  }, 0);

  const stats = [
    { label: "Stablecoins", value: String(stablecoins.length) },
    { label: "24h Volume", value: formatCompact(totalVolume) },
    { label: "Block Height", value: blockHeight > 0 ? blockHeight.toLocaleString() : "\u2014" },
    { label: "MPP Txns", value: "\u2014" },
    { label: "Liquidity", value: formatCompact(totalSupply) },
  ];

  return (
    <div className="explorer-page" style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 64px" }}>
      {/* Header */}
      <header style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
            marginBottom: 6,
          }}
        >
          Explorer
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-tertiary)",
            marginBottom: 0,
          }}
        >
          Search stablecoins, addresses, transactions, and blocks on Tempo.
        </p>
      </header>

      {/* Search */}
      <ExplorerSearch />

      {/* Stats row — 5 outlined cells */}
      <div
        className="explorer-stats"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 8,
          marginBottom: 24,
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              border: "1px solid var(--color-border-subtle)",
              borderRadius: 8,
              padding: 20,
              textAlign: "center",
              background: "transparent",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 18,
                fontWeight: 600,
                color: "var(--color-text-primary)",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.02em",
                marginBottom: 4,
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--color-text-quaternary)",
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Graphics row — Supply distribution + Flow diagram */}
      <div className="explorer-graphics" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <SupplyDistribution stablecoins={stablecoins} />
        <StablecoinFlows />
      </div>

      {/* Main content: stablecoin table + sidebar */}
      <div
        className="explorer-main-grid"
        style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}
      >
        <div>
          <StablecoinsTable stablecoins={stablecoins} />
        </div>

        {/* Sidebar */}
        <Sidebar />
      </div>

      {/* Quote Token Tree — full width */}
      <div style={{ marginTop: 24 }}>
        <QuoteTokenTree />
      </div>
    </div>
  );
}
