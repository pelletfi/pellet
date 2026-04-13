import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import SafetyBadge from "@/components/SafetyBadge";
import { getMarketData } from "@/lib/pipeline/market";
import { scanSafety } from "@/lib/pipeline/safety";
import { getCompliance, isTip20 } from "@/lib/pipeline/compliance";
import { getHolders } from "@/lib/pipeline/holders";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatUsd(value: number): string {
  if (value === 0) return "$0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (abs >= 1) return `$${value.toFixed(4)}`;
  return `$${value.toPrecision(4)}`;
}

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "#13131a",
        border: "1px solid #1a1a1f",
        borderRadius: "10px",
        padding: "20px",
        marginBottom: "16px",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
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
    </section>
  );
}

function DataRow({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 0",
        borderBottom: "1px solid #0f0f11",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          fontSize: "12px",
          color: "#555",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: mono ? "var(--font-geist-mono), monospace" : "var(--font-geist-sans)",
          fontSize: "13px",
          color: "#c4c4c4",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function TokenPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;

  // Validate address format
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    notFound();
  }

  const addr = address as `0x${string}`;

  // Run pipeline in parallel
  const [market, compliance] = await Promise.all([
    getMarketData(addr).catch(() => null),
    getCompliance(addr).catch(() => null),
  ]);

  if (!market) notFound();

  const tip20 = compliance?.token_type === "tip20";

  const [safety, holders] = await Promise.all([
    scanSafety(addr, tip20, market.pools).catch(() => null),
    getHolders(addr).catch(() => null),
  ]);

  return (
    <div style={{ minHeight: "100vh" }}>
      <Nav />

      <main
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
          padding: "32px 24px",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            {compliance && (
              <span
                style={{
                  fontFamily: "var(--font-geist-mono), monospace",
                  fontSize: "11px",
                  color: "#4ade80",
                  background: "rgba(74,222,128,0.08)",
                  border: "1px solid rgba(74,222,128,0.2)",
                  borderRadius: "4px",
                  padding: "2px 7px",
                }}
              >
                {compliance.token_type.toUpperCase()}
              </span>
            )}
          </div>

          <div
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: "13px",
              color: "#555",
              marginBottom: "20px",
            }}
          >
            {address}
          </div>

          {/* Key metrics row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            {[
              { label: "Price", value: formatUsd(market.price_usd) },
              { label: "Volume 24h", value: formatUsd(market.volume_24h) },
              { label: "Liquidity", value: formatUsd(market.liquidity_usd) },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  background: "#13131a",
                  border: "1px solid #1a1a1f",
                  borderRadius: "8px",
                  padding: "14px 16px",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-geist-sans)",
                    fontSize: "11px",
                    color: "#555",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-geist-mono), monospace",
                    fontSize: "18px",
                    fontWeight: 600,
                    color: "#f5f5f5",
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Deep briefing CTA */}
          <a
            href={`/token/${address}/briefing`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              background: "#4ade80",
              borderRadius: "8px",
              textDecoration: "none",
              fontFamily: "var(--font-geist-sans)",
              fontSize: "14px",
              fontWeight: 600,
              color: "#0f0f11",
              transition: "opacity 0.15s",
            }}
          >
            Deep Briefing
            <span
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: "11px",
                fontWeight: 400,
                background: "rgba(0,0,0,0.15)",
                borderRadius: "3px",
                padding: "1px 5px",
              }}
            >
              $0.05
            </span>
          </a>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {/* Safety */}
          <div>
            <Section title="Safety">
              {safety ? (
                <SafetyBadge safety={safety} />
              ) : (
                <p style={{ fontFamily: "var(--font-geist-sans)", fontSize: "13px", color: "#444" }}>
                  Safety analysis unavailable.
                </p>
              )}
            </Section>

            {/* Compliance */}
            {compliance && (
              <Section title="Compliance">
                <DataRow label="Token type" value={compliance.token_type.toUpperCase()} />
                <DataRow label="Paused" value={compliance.paused ? "YES" : "no"} />
                <DataRow label="Policy type" value={compliance.policy_type ?? "—"} />
                {compliance.policy_admin && (
                  <DataRow label="Policy admin" value={truncate(compliance.policy_admin)} />
                )}
                {compliance.supply_cap && (
                  <DataRow label="Supply cap" value={compliance.supply_cap} />
                )}
                {compliance.headroom_pct !== null && (
                  <DataRow
                    label="Headroom"
                    value={`${compliance.headroom_pct.toFixed(1)}%`}
                  />
                )}
              </Section>
            )}
          </div>

          <div>
            {/* Distribution */}
            {holders && (
              <Section title="Distribution">
                <DataRow label="Total holders" value={holders.total_holders.toLocaleString()} />
                <DataRow label="Top 5%" value={`${holders.top5_pct.toFixed(2)}%`} />
                <DataRow label="Top 10%" value={`${holders.top10_pct.toFixed(2)}%`} />
                <DataRow label="Top 20%" value={`${holders.top20_pct.toFixed(2)}%`} />

                {holders.top_holders.length > 0 && (
                  <div style={{ marginTop: "14px" }}>
                    <div
                      style={{
                        fontFamily: "var(--font-geist-sans)",
                        fontSize: "11px",
                        color: "#444",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        marginBottom: "8px",
                      }}
                    >
                      Top 10 holders
                    </div>
                    {holders.top_holders.slice(0, 10).map((h, i) => (
                      <div
                        key={h.address}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "4px 0",
                          borderBottom: "1px solid #111115",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                            fontSize: "11px",
                            color: "#666",
                            display: "flex",
                            gap: "6px",
                          }}
                        >
                          <span style={{ color: "#333", minWidth: "14px" }}>{i + 1}</span>
                          {h.label ? (
                            <span style={{ color: "#c4c4c4" }}>{h.label}</span>
                          ) : (
                            truncate(h.address)
                          )}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                            fontSize: "11px",
                            color: "#888",
                          }}
                        >
                          {h.pct.toFixed(2)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            )}

            {/* Pools */}
            {market.pools.length > 0 && (
              <Section title="Pools">
                {market.pools.slice(0, 5).map((pool) => (
                  <div
                    key={pool.address}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 0",
                      borderBottom: "1px solid #0f0f11",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-geist-sans)",
                          fontSize: "12px",
                          color: "#888",
                          textTransform: "capitalize",
                        }}
                      >
                        {pool.dex}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-geist-mono), monospace",
                          fontSize: "11px",
                          color: "#444",
                        }}
                      >
                        {truncate(pool.address)}
                      </span>
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--font-geist-mono), monospace",
                        fontSize: "12px",
                        color: "#c4c4c4",
                      }}
                    >
                      {formatUsd(pool.reserve_usd)}
                    </span>
                  </div>
                ))}
              </Section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
