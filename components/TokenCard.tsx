import Link from "next/link";

function formatUsd(value: number): string {
  if (value === 0) return "$0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (abs >= 1) return `$${value.toFixed(4)}`;
  return `$${value.toPrecision(4)}`;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export interface TokenCardProps {
  address: string;
  name: string;
  imageUrl?: string | null;
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
}

export default function TokenCard({
  address,
  name,
  imageUrl,
  priceUsd,
  priceChange24h,
  volume24h,
  liquidity,
}: TokenCardProps) {
  return (
    <Link
      href={`/token/${address}`}
      className="table-data-row"
      style={{
        gridTemplateColumns: "2.5fr 1fr 1fr 1fr",
        alignItems: "center",
        padding: "12px 16px",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      {/* Token: icon + name + address */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            width={28}
            height={28}
            style={{ borderRadius: "50%", flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--color-bg-emphasis)",
              color: "var(--color-text-tertiary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
              fontFamily: "var(--font-mono)",
            }}
          >
            {name?.charAt(0)?.toUpperCase() || "?"}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: 0 }}>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--color-text-primary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </span>
          {address && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--color-text-quaternary)",
              }}
            >
              {truncateAddress(address)}
            </span>
          )}
        </div>
      </div>

      {/* Price + change */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1px", textAlign: "right" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
            fontVariantNumeric: "tabular-nums",
            color: "var(--color-text-primary)",
          }}
        >
          {priceUsd > 0 ? formatUsd(priceUsd) : "—"}
        </span>
        {priceChange24h !== 0 && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: priceChange24h >= 0 ? "var(--color-success)" : "var(--color-error)",
            }}
          >
            {priceChange24h >= 0 ? "+" : ""}
            {priceChange24h.toFixed(2)}%
          </span>
        )}
      </div>

      {/* Volume 24h */}
      <div className="hide-mobile" style={{ textAlign: "right" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
            color: "var(--color-text-tertiary)",
          }}
        >
          {volume24h > 0 ? formatUsd(volume24h) : "—"}
        </span>
      </div>

      {/* Liquidity */}
      <div className="hide-mobile" style={{ textAlign: "right" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
            color: "var(--color-text-tertiary)",
          }}
        >
          {liquidity > 0 ? formatUsd(liquidity) : "—"}
        </span>
      </div>
    </Link>
  );
}
