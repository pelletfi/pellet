import Nav from "@/components/Nav";
import StablecoinRow from "@/components/StablecoinRow";
import { getAllStablecoins } from "@/lib/pipeline/stablecoins";
import Link from "next/link";

function ColHeader({ label, right }: { label: string; right?: boolean }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        fontSize: "10px",
        fontWeight: 500,
        color: "#444",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
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
    <div style={{ minHeight: "100vh" }}>
      <Nav />

      <main
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "32px 24px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
          <div>
            <h1
              style={{
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                fontSize: "20px",
                fontWeight: 600,
                color: "#f5f5f5",
                letterSpacing: "-0.02em",
                marginBottom: "4px",
              }}
            >
              Stablecoins
            </h1>
            <p
              style={{
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                fontSize: "13px",
                color: "#555",
              }}
            >
              TIP-20 stablecoins on Tempo — peg status, policy, supply
            </p>
          </div>

          <Link
            href="/stablecoins/flows"
            style={{
              fontFamily: "var(--font-geist-sans)",
              fontSize: "13px",
              color: "#888",
              textDecoration: "none",
              padding: "7px 12px",
              border: "1px solid #1a1a1f",
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
            border: "1px solid #1a1a1f",
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
              background: "#0d0d10",
              borderBottom: "1px solid #1a1a1f",
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
                fontFamily: "var(--font-geist-sans)",
                fontSize: "14px",
                color: "#555",
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
            { color: "#4ade80", label: "tight peg (<0.1%)" },
            { color: "#fbbf24", label: "mild deviation (<0.5%)" },
            { color: "#f87171", label: "notable deviation (≥0.5%)" },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, flexShrink: 0 }} />
              <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: "11px", color: "#444" }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
