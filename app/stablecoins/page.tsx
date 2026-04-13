import StablecoinRow from "@/components/StablecoinRow";
import { getAllStablecoins } from "@/lib/pipeline/stablecoins";
import Link from "next/link";

function ColHeader({ label, right }: { label: string; right?: boolean }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono), monospace",
        fontSize: "10px",
        fontWeight: 500,
        color: "var(--color-muted)",
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
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "var(--color-text)",
              letterSpacing: "-0.02em",
              marginBottom: "4px",
            }}
          >
            Stablecoins
          </h1>
          <p
            style={{
              fontSize: "15px",
              color: "var(--color-secondary)",
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
            color: "var(--color-secondary)",
            textDecoration: "none",
            padding: "7px 12px",
            border: "1px solid var(--color-border)",
            background: "#fff",
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
          border: "1px solid var(--color-border)",
          borderRadius: "10px",
          overflow: "hidden",
        }}
      >
        {/* Column headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "160px 90px 70px 110px 130px 90px 70px 80px",
            padding: "10px 16px",
            background: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)",
            gap: "8px",
          }}
        >
          <ColHeader label="Symbol" />
          <ColHeader label="Price" />
          <ColHeader label="Spread" />
          <ColHeader label="Policy" />
          <ColHeader label="Supply" right />
          <ColHeader label="Headroom" right />
          <ColHeader label="Ccy" />
          <ColHeader label="Yield" right />
        </div>

        {/* Rows */}
        {stablecoins.length === 0 ? (
          <div
            style={{
              padding: "40px 16px",
              textAlign: "center",
              fontSize: "14px",
              color: "var(--color-secondary)",
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
      <div
        style={{
          marginTop: "16px",
          display: "flex",
          gap: "20px",
        }}
      >
        {[
          { color: "var(--color-positive)", label: "tight peg (<0.1%)" },
          { color: "#d97706", label: "mild deviation (<0.5%)" },
          { color: "var(--color-negative)", label: "notable deviation (≥0.5%)" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "var(--color-muted)" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
