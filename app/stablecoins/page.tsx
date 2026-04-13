import StablecoinRow from "@/components/StablecoinRow";
import { getAllStablecoins } from "@/lib/pipeline/stablecoins";
import Link from "next/link";

function ColHeader({ label, right }: { label: string; right?: boolean }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono), monospace",
        fontSize: "11px",
        fontWeight: 500,
        color: "var(--color-text-quaternary)",
        textTransform: "uppercase",
        letterSpacing: "1.5px",
        textAlign: right ? "right" : "left",
      }}
    >
      {label}
    </span>
  );
}

export default async function StablecoinsPage() {
  let stablecoins = await getAllStablecoins().catch(() => []);

  return (
    <main className="page-container">
      {/* Header */}
      <div className="stablecoins-header">
        <div>
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              letterSpacing: "-0.02em",
              marginBottom: "4px",
            }}
          >
            Stablecoins
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "var(--color-text-tertiary)",
            }}
          >
            TIP-20 stablecoins on Tempo — peg status, policy, supply
          </p>
        </div>

        <Link
          href="/stablecoins/flows"
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: "13px",
            color: "var(--color-text-secondary)",
            textDecoration: "none",
            padding: "7px 12px",
            border: "1px solid var(--color-border-default)",
            background: "var(--color-bg-subtle)",
            borderRadius: "6px",
            transition: "border-color 0.15s",
          }}
        >
          Flow matrix →
        </Link>
      </div>

      {/* Table */}
      <div
        style={{
          border: "1px solid var(--color-border-subtle)",
          borderRadius: "10px",
          overflow: "hidden",
        }}
      >
        {/* Column headers */}
        <div
          className="stablecoin-table-header"
          style={{
            display: "grid",
            gridTemplateColumns: "160px 90px 70px 110px 130px 90px 70px 80px",
            padding: "10px 16px",
            background: "var(--color-bg-subtle)",
            borderBottom: "1px solid var(--color-border-subtle)",
            gap: "8px",
          }}
        >
          <ColHeader label="Symbol" />
          <ColHeader label="Price" />
          <ColHeader label="Spread" />
          <span className="hide-mobile"><ColHeader label="Policy" /></span>
          <span className="hide-mobile"><ColHeader label="Supply" right /></span>
          <span className="hide-mobile"><ColHeader label="Headroom" right /></span>
          <span className="hide-mobile"><ColHeader label="Ccy" /></span>
          <span className="hide-mobile"><ColHeader label="Yield" right /></span>
        </div>

        {/* Rows */}
        {stablecoins.length === 0 ? (
          <div
            style={{
              padding: "40px 16px",
              textAlign: "center",
              fontSize: "14px",
              color: "var(--color-text-secondary)",
            }}
          >
            No stablecoins available.
          </div>
        ) : (
          stablecoins.map((token) => (
            <StablecoinRow key={token.address} token={token} />
          ))
        )}
      </div>

      {/* Legend */}
      <div className="stablecoins-legend">
        {[
          { color: "var(--color-success)", label: "tight peg (<0.1%)" },
          { color: "var(--color-warning)", label: "mild deviation (<0.5%)" },
          { color: "var(--color-error)", label: "notable deviation (≥0.5%)" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "var(--color-text-quaternary)" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
