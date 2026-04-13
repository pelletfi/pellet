import type { Metadata } from "next";
import { getPools, searchTokens } from "@/lib/gecko";
import { getAllStablecoins } from "@/lib/pipeline/stablecoins";
import { getLatestBlockNumber } from "@/lib/explorer";
import { getTokenIcons } from "@/lib/token-icons";
import { StatsBar } from "@/components/StatsBar";
import TokenCard from "@/components/TokenCard";
import Link from "next/link";
import { ExplorerSearch } from "./ExplorerSearch";
import { LiquidityTreemap } from "./LiquidityTreemap";

export const metadata: Metadata = {
  title: "Explorer — Pellet",
  description:
    "Tempo blockchain explorer. Search tokens, addresses, transactions, and blocks.",
};

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n > 0) return `$${n.toFixed(0)}`;
  return "$0";
}

export default async function ExplorerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  // Parallel data fetching
  const [poolsRes, stablecoins, blockHeight] = await Promise.all([
    query ? searchTokens(query) : getPools(page),
    getAllStablecoins().catch(() => []),
    getLatestBlockNumber().catch(() => 0),
  ]);

  const pools = poolsRes.data ?? [];

  // Deduplicate by base token address
  const seen = new Set<string>();
  const tokens: {
    address: string;
    name: string;
    imageUrl: string | null;
    priceUsd: number;
    priceChange24h: number;
    volume24h: number;
    liquidity: number;
  }[] = [];

  const addresses: string[] = [];

  for (const pool of pools) {
    const baseId = pool.relationships?.base_token?.data?.id;
    if (!baseId) continue;

    const addr = baseId.includes("_") ? baseId.split("_").pop()! : baseId;
    if (!addr || seen.has(addr.toLowerCase())) continue;
    seen.add(addr.toLowerCase());
    addresses.push(addr);

    const poolName = pool.attributes.name ?? "";
    const tokenName = poolName.split(" / ")[0] ?? poolName;

    tokens.push({
      address: addr,
      name: tokenName,
      imageUrl: null,
      priceUsd: parseFloat(pool.attributes.base_token_price_usd ?? "0"),
      priceChange24h: parseFloat(
        pool.attributes.price_change_percentage?.h24 ?? "0"
      ),
      volume24h: parseFloat(pool.attributes.volume_usd?.h24 ?? "0"),
      liquidity: parseFloat(pool.attributes.reserve_in_usd ?? "0"),
    });
  }

  // Resolve icons
  const icons = await getTokenIcons(addresses);
  for (const t of tokens) {
    const info = icons.get(t.address.toLowerCase());
    if (info) {
      t.imageUrl = info.iconUrl;
      if (info.name && !t.name) t.name = info.name;
    }
  }

  // Aggregate stats
  const totalVolume = tokens.reduce((sum, t) => sum + t.volume24h, 0);
  const totalLiquidity = tokens.reduce((sum, t) => sum + t.liquidity, 0);

  const stats = [
    { label: "Tokens", value: String(tokens.length) },
    { label: "Stablecoins", value: String(stablecoins.length) },
    { label: "24h Volume", value: formatCompact(totalVolume) },
    { label: "Block Height", value: blockHeight > 0 ? blockHeight.toLocaleString() : "\u2014" },
    { label: "MPP Txns", value: "\u2014" },
    { label: "Liquidity", value: formatCompact(totalLiquidity) },
  ];

  const hasNext = !query && poolsRes.links?.next != null;
  const hasPrev = page > 1;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 64px" }}>
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
          Tempo blockchain explorer. Search tokens, addresses, transactions, and
          blocks.
        </p>
      </header>

      {/* Search */}
      <ExplorerSearch />

      {/* Stats row — 6 cells, shared-border grid */}
      <div
        className="stats-bar"
        style={{ gridTemplateColumns: "repeat(6, 1fr)", marginBottom: 24 }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "var(--color-bg-subtle)",
              padding: 20,
              textAlign: "center",
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

      {/* Graphics row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <LiquidityTreemap
          tokens={[...tokens]
            .sort((a, b) => b.liquidity - a.liquidity)
            .slice(0, 5)
            .map((t) => ({ name: t.name, liquidity: t.liquidity }))}
        />
        <div>{/* Reserved for chart — Tasks 5-7 */}</div>
      </div>

      {/* Main content: token table + sidebar */}
      <div
        className="explorer-main-grid"
        style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}
      >
        {/* Token table */}
        <div>
          <div className="data-table">
            {/* Table header */}
            <div
              className="table-header-row"
              style={{ gridTemplateColumns: "2.5fr 1fr 1fr 1fr" }}
            >
              {["Token", "Price", "Volume 24H", "Liquidity"].map((label) => (
                <span
                  key={label}
                  className={
                    label === "Volume 24H" || label === "Liquidity"
                      ? "hide-mobile"
                      : undefined
                  }
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "var(--color-text-quaternary)",
                    textAlign: label === "Token" ? "left" : "right",
                  }}
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Token rows */}
            {tokens.length === 0 ? (
              <div
                style={{
                  padding: "48px 16px",
                  textAlign: "center",
                  fontSize: 14,
                  color: "var(--color-text-tertiary)",
                }}
              >
                {query
                  ? `No tokens found for "${query}".`
                  : "No tokens available."}
              </div>
            ) : (
              tokens.map((t) => (
                <TokenCard
                  key={t.address}
                  address={t.address}
                  name={t.name}
                  imageUrl={t.imageUrl}
                  priceUsd={t.priceUsd}
                  priceChange24h={t.priceChange24h}
                  volume24h={t.volume24h}
                  liquidity={t.liquidity}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          {!query && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "24px 16px 0",
              }}
            >
              {hasPrev ? (
                <Link
                  href={`/explorer?page=${page - 1}`}
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--color-text-secondary)",
                    textDecoration: "none",
                    padding: "8px 16px",
                    background: "var(--color-bg-subtle)",
                    border: "1px solid var(--color-border-default)",
                    borderRadius: 6,
                    transition:
                      "background 150ms ease, border-color 150ms ease",
                  }}
                >
                  &larr; Previous
                </Link>
              ) : (
                <span />
              )}
              {hasNext ? (
                <Link
                  href={`/explorer?page=${page + 1}`}
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--color-text-secondary)",
                    textDecoration: "none",
                    padding: "8px 16px",
                    background: "var(--color-bg-subtle)",
                    border: "1px solid var(--color-border-default)",
                    borderRadius: 6,
                    transition:
                      "background 150ms ease, border-color 150ms ease",
                  }}
                >
                  Next &rarr;
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </div>

        {/* Sidebar placeholder */}
        <div>{/* Reserved for sidebar — Tasks 4-7 */}</div>
      </div>
    </div>
  );
}
