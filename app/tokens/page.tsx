import { getPools, searchTokens } from "@/lib/gecko";
import Search from "@/components/Search";
import TokenCard from "@/components/TokenCard";
import Link from "next/link";
import { getTokenIcons } from "@/lib/token-icons";

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function TokensPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  const res = query ? await searchTokens(query) : await getPools(page);
  const pools = res.data ?? [];

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
      imageUrl: null, // filled below
      priceUsd: parseFloat(pool.attributes.base_token_price_usd ?? "0"),
      priceChange24h: parseFloat(pool.attributes.price_change_percentage?.h24 ?? "0"),
      volume24h: parseFloat(pool.attributes.volume_usd?.h24 ?? "0"),
      liquidity: parseFloat(pool.attributes.reserve_in_usd ?? "0"),
    });
  }

  // Resolve icons from official Tempo token list
  const icons = await getTokenIcons(addresses);
  for (const t of tokens) {
    const info = icons.get(t.address.toLowerCase());
    if (info) {
      t.imageUrl = info.iconUrl;
      if (info.name && !t.name) t.name = info.name;
    }
  }

  const hasNext = !query && (res.links?.next != null);
  const hasPrev = page > 1;

  return (
    <div className="page-container">
      {/* Header */}
      <h1
        style={{
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontSize: "28px",
          fontWeight: 700,
          color: "var(--color-text)",
          marginBottom: "6px",
        }}
      >
        Tokens
      </h1>
      <p
        style={{
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontSize: "15px",
          color: "var(--color-secondary)",
          marginBottom: "28px",
        }}
      >
        Every token on Tempo, tracked and examined.
      </p>

      {/* Search */}
      <div style={{ marginBottom: "32px" }}>
        <Search defaultValue={query} />
      </div>

      {/* Table header */}
      <div
        className="token-table-header"
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {["Token", "Price", "Volume 24H", "Liquidity"].map((label) => (
          <span
            key={label}
            className={label === "Volume 24H" || label === "Liquidity" ? "hide-mobile" : undefined}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              color: "var(--color-muted)",
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
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontSize: "14px",
            color: "var(--color-muted)",
          }}
        >
          {query ? `No tokens found for "${query}".` : "No tokens available."}
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
              href={`/tokens?page=${page - 1}`}
              style={{
                fontFamily: "var(--font-inter), system-ui, sans-serif",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--color-text)",
                textDecoration: "none",
                padding: "8px 16px",
                border: "1px solid var(--color-border)",
                borderRadius: "6px",
                transition: "background 0.15s",
              }}
            >
              &larr; Previous
            </Link>
          ) : (
            <span />
          )}
          {hasNext ? (
            <Link
              href={`/tokens?page=${page + 1}`}
              style={{
                fontFamily: "var(--font-inter), system-ui, sans-serif",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--color-text)",
                textDecoration: "none",
                padding: "8px 16px",
                border: "1px solid var(--color-border)",
                borderRadius: "6px",
                transition: "background 0.15s",
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
  );
}
