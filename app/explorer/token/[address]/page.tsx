import { notFound } from "next/navigation";
import SafetyBadge from "@/components/SafetyBadge";
import { getMarketData } from "@/lib/pipeline/market";
import { scanSafety } from "@/lib/pipeline/safety";
import { getCompliance, isTip20 } from "@/lib/pipeline/compliance";
import { getHolders } from "@/lib/pipeline/holders";
import { getTokenIconUrl } from "@/lib/token-icons";

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
        background: "var(--color-bg-subtle)",
        border: "1px solid var(--color-border-subtle)",
        borderRadius: "8px",
        padding: "24px",
        marginBottom: "16px",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--color-text-tertiary)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: "14px",
          paddingBottom: "10px",
          borderBottom: "1px solid var(--color-border-subtle)",
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
        borderBottom: "1px solid var(--color-border-subtle)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          color: "var(--color-text-tertiary)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
          fontSize: "14px",
          color: "var(--color-text-primary)",
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

  const [safety, holders, iconUrl] = await Promise.all([
    scanSafety(addr, tip20, market.pools).catch(() => null),
    getHolders(addr).catch(() => null),
    getTokenIconUrl(addr),
  ]);

  return (
    <main className="page-container-narrow">
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          {iconUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={iconUrl}
              alt=""
              width={32}
              height={32}
              style={{ borderRadius: "50%" }}
            />
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--color-bg-emphasis)",
                color: "var(--color-text-tertiary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "var(--font-mono)",
              }}
            >
              {address.slice(2, 4).toUpperCase()}
            </div>
          )}
          {compliance && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--color-success)",
                background: "rgba(48,164,108,0.12)",
                border: "1px solid rgba(48,164,108,0.25)",
                borderRadius: "4px",
                padding: "2px 7px",
              }}
            >
              {compliance.token_type.toUpperCase()}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "4px" }}>
          <div className="address-text">
            {address}
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--color-text-quaternary)",
            }}
          >
            GET /v1/tokens/{address}
          </span>
        </div>

        {/* Key metrics row */}
        <div className="metrics-grid">
          {[
            { label: "Price", value: formatUsd(market.price_usd) },
            { label: "Volume 24h", value: formatUsd(market.volume_24h) },
            { label: "Liquidity", value: formatUsd(market.liquidity_usd) },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                background: "var(--color-bg-subtle)",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: "8px",
                padding: "20px",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--color-text-quaternary)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "22px",
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--color-text-primary)",
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Deep briefing CTA */}
        <div style={{ textAlign: "center" }}>
          <a
            href={`/explorer/token/${address}/briefing`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              background: "var(--color-text-primary)",
              borderRadius: "8px",
              textDecoration: "none",
              fontFamily: "var(--font-sans)",
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--color-bg-base)",
              transition: "opacity 0.15s",
            }}
          >
            Deep Briefing
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                fontWeight: 400,
                background: "rgba(255,255,255,0.15)",
                borderRadius: "3px",
                padding: "1px 5px",
              }}
            >
              $0.05
            </span>
          </a>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--color-text-quaternary)",
              marginTop: "8px",
            }}
          >
            Paid via Tempo MPP
          </div>
        </div>
      </div>

      <div className="detail-two-col">
        {/* Safety */}
        <div>
          <Section title="Safety">
            {safety ? (
              <SafetyBadge safety={safety} />
            ) : (
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--color-text-tertiary)" }}>
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
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                      color: "var(--color-text-quaternary)",
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
                        borderBottom: "1px solid var(--color-border-subtle)",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "11px",
                          color: "var(--color-text-secondary)",
                          display: "flex",
                          gap: "6px",
                        }}
                      >
                        <span style={{ color: "var(--color-text-tertiary)", minWidth: "14px" }}>{i + 1}</span>
                        {h.label ? (
                          <span style={{ color: "var(--color-text-primary)" }}>{h.label}</span>
                        ) : (
                          truncate(h.address)
                        )}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "11px",
                          color: "var(--color-text-secondary)",
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
                    borderBottom: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "12px",
                        color: "var(--color-text-secondary)",
                        textTransform: "capitalize",
                      }}
                    >
                      {pool.dex}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "11px",
                        color: "var(--color-text-tertiary)",
                      }}
                    >
                      {truncate(pool.address)}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "12px",
                      color: "var(--color-text-primary)",
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
  );
}
