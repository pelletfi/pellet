import type { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Fee economics — Pellet",
  description: "Which Tempo stablecoins are winning as fee tokens. Ecosystem-wide view, updated every 5 minutes.",
};

export const dynamic = "force-dynamic";

interface OverviewResponse {
  as_of: string | null;
  totals: {
    users_electing: number;
    validators_electing: number;
    fees_distributed_7d_tokens: number;
    fees_distributed_all_time_tokens: number;
    distribution_count: number;
  };
  stablecoins: Array<{
    address: string;
    symbol: string;
    name: string;
    users_electing: number;
    validators_electing: number;
    fees_received_24h_tokens: number;
    fees_received_7d_tokens: number;
    fees_received_all_time_tokens: number;
    share_of_fees_7d_pct: number | null;
    distribution_count: number;
  }>;
  recent_distributions: Array<{
    validator: string;
    validator_label: string | null;
    token: string;
    token_symbol: string | null;
    amount_tokens: number;
    block_number: number;
    block_timestamp: string;
    tx_hash: string;
  }>;
}

async function getOverview(): Promise<OverviewResponse | null> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "pelletfi.com";
  const url = `${proto}://${host}/api/v1/fee-economics/overview`;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as OverviewResponse;
  } catch {
    return null;
  }
}

function fmt(n: number, max = 2) {
  return n.toLocaleString(undefined, { maximumFractionDigits: max });
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function FeeEconomicsPage() {
  const data = await getOverview();

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px 80px" }}>
      {/* ─── Header / eyebrow ─── */}
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--color-text-quaternary)",
          marginBottom: 12,
        }}
      >
        Tempo ecosystem · fee manager precompile
      </div>

      <h1
        style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: "clamp(40px, 6vw, 72px)",
          lineHeight: 1.02,
          letterSpacing: "-0.02em",
          fontWeight: 400,
          color: "var(--color-text-primary)",
          margin: "0 0 20px",
        }}
      >
        Which stables pay the chain.
      </h1>

      <p
        style={{
          maxWidth: 680,
          fontSize: 17,
          lineHeight: 1.55,
          color: "var(--color-text-tertiary)",
          margin: "0 0 56px",
        }}
      >
        Tempo users and validators elect a TIP-20 to pay fees in. Pellet indexes the fee
        manager precompile directly — invisible to standard indexers. Below: the live
        leaderboard of which stables are winning as fee tokens.
      </p>

      {!data && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            color: "var(--color-text-quaternary)",
          }}
        >
          Data unavailable. Try again in a moment.
        </div>
      )}

      {data && (
        <>
          {/* ─── Totals row ─── */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 24,
              paddingTop: 24,
              paddingBottom: 24,
              borderTop: "1px solid var(--color-border-subtle)",
              borderBottom: "1px solid var(--color-border-subtle)",
              marginBottom: 48,
            }}
          >
            <Totals label="Users electing" value={fmt(data.totals.users_electing, 0)} />
            <Totals label="Validators electing" value={fmt(data.totals.validators_electing, 0)} />
            <Totals label="Fees distributed 7d" value={fmt(data.totals.fees_distributed_7d_tokens, 2)} suffix="tokens" />
            <Totals label="Total distributions" value={fmt(data.totals.distribution_count, 0)} />
          </section>

          {/* ─── Leaderboard table ─── */}
          <section style={{ marginBottom: 56 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--color-text-quaternary)",
                marginBottom: 16,
              }}
            >
              Leaderboard — by 7d fee revenue
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--color-border-subtle)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    fontSize: 10,
                    color: "var(--color-text-quaternary)",
                  }}
                >
                  <Th align="left">Stable</Th>
                  <Th>Users</Th>
                  <Th>Validators</Th>
                  <Th>Fees 24h</Th>
                  <Th>Fees 7d</Th>
                  <Th>Share 7d</Th>
                </tr>
              </thead>
              <tbody>
                {data.stablecoins.map((s) => (
                  <tr
                    key={s.address}
                    style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
                  >
                    <Td align="left">
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-sans)", fontSize: 14 }}>
                          {s.symbol}
                        </span>
                        <span style={{ color: "var(--color-text-quaternary)", fontSize: 11 }}>
                          {s.name}
                        </span>
                      </div>
                    </Td>
                    <Td>{s.users_electing}</Td>
                    <Td>{s.validators_electing}</Td>
                    <Td dim={s.fees_received_24h_tokens === 0}>{fmt(s.fees_received_24h_tokens)}</Td>
                    <Td dim={s.fees_received_7d_tokens === 0}>{fmt(s.fees_received_7d_tokens)}</Td>
                    <Td>
                      {s.share_of_fees_7d_pct != null ? (
                        <ShareBar pct={s.share_of_fees_7d_pct} />
                      ) : (
                        <span style={{ color: "var(--color-text-quaternary)" }}>—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* ─── Recent distributions ─── */}
          {data.recent_distributions.length > 0 && (
            <section style={{ marginBottom: 48 }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--color-text-quaternary)",
                  marginBottom: 16,
                }}
              >
                Recent distributions
              </div>
              <div>
                {data.recent_distributions.map((d) => (
                  <div
                    key={d.tx_hash}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      padding: "14px 0",
                      borderBottom: "1px solid var(--color-border-subtle)",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: "var(--color-text-primary)", fontSize: 14 }}>
                        {d.validator_label ?? shortAddr(d.validator)}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          color: "var(--color-text-quaternary)",
                          marginTop: 2,
                        }}
                      >
                        {fmtTime(d.block_timestamp)} · block {d.block_number}
                      </div>
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        color: "var(--color-text-primary)",
                        fontVariantNumeric: "tabular-nums",
                        textAlign: "right",
                      }}
                    >
                      {fmt(d.amount_tokens)}{" "}
                      <span style={{ color: "var(--color-text-quaternary)" }}>
                        {d.token_symbol ?? shortAddr(d.token)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ─── Footer ─── */}
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--color-text-quaternary)",
              paddingTop: 24,
              borderTop: "1px solid var(--color-border-subtle)",
            }}
          >
            Decoded every 5 min from feeManager precompile (0xfeec…0000). Full
            methodology at{" "}
            <a
              href="/docs/methodology"
              style={{ color: "var(--color-text-tertiary)", textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              /docs/methodology
            </a>.
          </div>
        </>
      )}
    </div>
  );
}

// ── Small presentational helpers ──────────────────────────────────────────────

function Totals({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--color-text-quaternary)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 22,
          color: "var(--color-text-primary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {suffix && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--color-text-quaternary)",
            marginTop: 2,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {suffix}
        </div>
      )}
    </div>
  );
}

function Th({ children, align = "right" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      style={{
        padding: "12px 8px",
        fontWeight: 500,
        textAlign: align,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "right",
  dim,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  dim?: boolean;
}) {
  return (
    <td
      style={{
        padding: "14px 8px",
        textAlign: align,
        color: dim ? "var(--color-text-quaternary)" : "var(--color-text-primary)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {children}
    </td>
  );
}

// Monochromatic horizontal bar. Fills proportional to `pct` (0-100).
function ShareBar({ pct }: { pct: number }) {
  const width = Math.max(2, Math.min(100, pct));
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
      <div
        style={{
          width: 80,
          height: 4,
          background: "var(--color-border-subtle)",
          position: "relative",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${width}%`,
            background: "var(--color-text-secondary)",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 12,
          color: "var(--color-text-primary)",
          fontVariantNumeric: "tabular-nums",
          minWidth: 40,
          textAlign: "right",
        }}
      >
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}
