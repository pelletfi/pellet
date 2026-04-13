import type {
  TokenMarketData,
  SafetyResult,
  ComplianceResult,
  HolderData,
  OriginResult,
  IdentityResult,
} from "@/lib/types";

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

function truncate(addr: string, front = 8, back = 6): string {
  if (addr.length <= front + back + 3) return addr;
  return `${addr.slice(0, front)}…${addr.slice(-back)}`;
}

// ── Primitives ────────────────────────────────────────────────────────────────

function SectionHeader({ n, title, source }: { n: string; title: string; source?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: "14px",
        paddingBottom: "8px",
        borderBottom: "1px solid #1a1a1f",
      }}
    >
      <div style={{ display: "flex", gap: "10px", alignItems: "baseline" }}>
        <span
          style={{
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: "11px",
            color: "#555",
            letterSpacing: "0.04em",
          }}
        >
          {n}
        </span>
        <span
          style={{
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            fontSize: "13px",
            fontWeight: 600,
            color: "#f5f5f5",
            letterSpacing: "0.01em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>
      </div>
      {source && (
        <span
          style={{
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: "10px",
            color: "#444",
          }}
        >
          {source}
        </span>
      )}
    </div>
  );
}

function DataRow({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "5px 0",
        borderBottom: "1px solid #13131a",
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
          fontFamily: mono ? "var(--font-geist-mono), monospace" : "var(--font-geist-sans), system-ui, sans-serif",
          fontSize: "12px",
          color: "#c4c4c4",
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function PendingRow({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "5px 0",
        borderBottom: "1px solid #13131a",
      }}
    >
      <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: "12px", color: "#555" }}>
        {label}
      </span>
      <span style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: "12px", color: "#333" }}>
        —
      </span>
    </div>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────

function MarketSection({ market }: { market: TokenMarketData }) {
  return (
    <section style={{ marginBottom: "28px" }}>
      <SectionHeader n="01" title="Market" source="GeckoTerminal" />
      <DataRow label="Price" value={formatUsd(market.price_usd)} />
      <DataRow label="Volume 24h" value={formatUsd(market.volume_24h)} />
      <DataRow label="Liquidity" value={formatUsd(market.liquidity_usd)} />
      {market.fdv_usd !== null ? (
        <DataRow label="FDV" value={formatUsd(market.fdv_usd)} />
      ) : (
        <PendingRow label="FDV" />
      )}
      <DataRow label="Pools" value={market.pools.length.toString()} />
    </section>
  );
}

function SafetySection({ safety }: { safety: SafetyResult }) {
  const verdictColor =
    safety.verdict === "LOW_RISK"
      ? "#4ade80"
      : safety.verdict === "CAUTION" || safety.verdict === "MEDIUM_RISK"
      ? "#fbbf24"
      : "#f87171";

  return (
    <section style={{ marginBottom: "28px" }}>
      <SectionHeader n="02" title="Safety" source="on-chain bytecode + simulation" />
      <DataRow
        label="Verdict"
        value={
          <span style={{ color: verdictColor }}>
            {safety.verdict.replace(/_/g, " ")}
          </span>
        }
      />
      <DataRow label="Risk score" value={`${safety.score} / 100`} />
      <DataRow label="Honeypot" value={safety.honeypot ? "YES" : "no"} />
      <DataRow label="Can buy" value={safety.can_buy ? "yes" : "NO"} />
      <DataRow label="Can sell" value={safety.can_sell ? "yes" : "NO"} />
      {safety.flags.length > 0 && (
        <div style={{ paddingTop: "8px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {safety.flags.map((f) => (
              <span
                key={f}
                style={{
                  fontFamily: "var(--font-geist-mono), monospace",
                  fontSize: "10px",
                  color: "#f87171",
                  background: "rgba(248,113,113,0.07)",
                  border: "1px solid rgba(248,113,113,0.18)",
                  borderRadius: "3px",
                  padding: "1px 5px",
                }}
              >
                {f}
              </span>
            ))}
            {safety.warnings.map((w) => (
              <span
                key={w}
                style={{
                  fontFamily: "var(--font-geist-mono), monospace",
                  fontSize: "10px",
                  color: "#fbbf24",
                  background: "rgba(251,191,36,0.07)",
                  border: "1px solid rgba(251,191,36,0.18)",
                  borderRadius: "3px",
                  padding: "1px 5px",
                }}
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ComplianceSection({ compliance }: { compliance: ComplianceResult }) {
  return (
    <section style={{ marginBottom: "28px" }}>
      <SectionHeader n="03" title="Compliance" source="TIP-20 factory + TIP-403 registry" />
      <DataRow label="Token type" value={compliance.token_type.toUpperCase()} />
      <DataRow label="Paused" value={compliance.paused ? "YES" : "no"} />
      {compliance.policy_type ? (
        <DataRow label="Policy" value={compliance.policy_type} />
      ) : (
        <PendingRow label="Policy" />
      )}
      {compliance.policy_admin ? (
        <DataRow label="Policy admin" value={truncate(compliance.policy_admin)} />
      ) : (
        <PendingRow label="Policy admin" />
      )}
      {compliance.supply_cap ? (
        <DataRow label="Supply cap" value={compliance.supply_cap} />
      ) : (
        <PendingRow label="Supply cap" />
      )}
      <DataRow label="Current supply" value={compliance.current_supply} />
      {compliance.headroom_pct !== null ? (
        <DataRow label="Headroom" value={`${compliance.headroom_pct.toFixed(1)}%`} />
      ) : (
        <PendingRow label="Headroom" />
      )}
    </section>
  );
}

function DistributionSection({ holders }: { holders: HolderData }) {
  return (
    <section style={{ marginBottom: "28px" }}>
      <SectionHeader n="04" title="Distribution" source="Transfer event replay" />
      <DataRow label="Total holders" value={holders.total_holders.toLocaleString()} />
      <DataRow label="Top 5 holders" value={`${holders.top5_pct.toFixed(2)}%`} />
      <DataRow label="Top 10 holders" value={`${holders.top10_pct.toFixed(2)}%`} />
      <DataRow label="Top 20 holders" value={`${holders.top20_pct.toFixed(2)}%`} />
      {holders.creator_address && (
        <DataRow label="Creator hold" value={`${(holders.creator_hold_pct ?? 0).toFixed(2)}%`} />
      )}

      {/* Top 10 holders table */}
      {holders.top_holders.length > 0 && (
        <div style={{ marginTop: "12px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 80px 60px",
              padding: "4px 0",
              borderBottom: "1px solid #1a1a1f",
              marginBottom: "4px",
            }}
          >
            {["Address", "Balance", "%"].map((h) => (
              <span
                key={h}
                style={{
                  fontFamily: "var(--font-geist-sans)",
                  fontSize: "10px",
                  color: "#444",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  textAlign: h === "%" || h === "Balance" ? "right" : "left",
                }}
              >
                {h}
              </span>
            ))}
          </div>
          {holders.top_holders.slice(0, 10).map((h, i) => (
            <div
              key={h.address}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 80px 60px",
                padding: "4px 0",
                borderBottom: "1px solid #111115",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-geist-mono), monospace",
                  fontSize: "11px",
                  color: "#888",
                  display: "flex",
                  gap: "6px",
                  alignItems: "center",
                }}
              >
                <span style={{ color: "#444", minWidth: "14px" }}>{i + 1}</span>
                {h.label ? (
                  <span style={{ color: "#c4c4c4" }}>{h.label}</span>
                ) : (
                  truncate(h.address, 6, 4)
                )}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-geist-mono), monospace",
                  fontSize: "11px",
                  color: "#555",
                  textAlign: "right",
                }}
              >
                {parseFloat(h.balance).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-geist-mono), monospace",
                  fontSize: "11px",
                  color: "#888",
                  textAlign: "right",
                }}
              >
                {h.pct.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function OriginSection({ origin }: { origin: OriginResult }) {
  return (
    <section style={{ marginBottom: "28px" }}>
      <SectionHeader n="05" title="Origin" source="transfer event log" />
      <DataRow label="Deployer" value={truncate(origin.deployer)} />
      <DataRow label="Deployer age" value={`${origin.deployer_age_days}d`} />
      <DataRow label="Deployer tx count" value={origin.deployer_tx_count.toLocaleString()} />
      {origin.funding_source ? (
        <>
          <DataRow label="Funding source" value={truncate(origin.funding_source)} />
          {origin.funding_label && (
            <DataRow label="Funding label" value={origin.funding_label} />
          )}
          <DataRow label="Funding hops" value={origin.funding_hops.toString()} />
        </>
      ) : (
        <PendingRow label="Funding source" />
      )}
      {origin.prior_tokens.length > 0 && (
        <DataRow label="Prior tokens" value={origin.prior_tokens.length.toString()} />
      )}
    </section>
  );
}

function AnalystSection({ text }: { text: string }) {
  return (
    <section style={{ marginBottom: "28px" }}>
      <SectionHeader n="06" title="Analyst Note" source="Claude Sonnet" />
      <p
        style={{
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          fontSize: "13px",
          lineHeight: 1.65,
          color: "#888",
          margin: 0,
        }}
      >
        {text}
      </p>
    </section>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface BriefingDocumentProps {
  address: string;
  identity?: IdentityResult | null;
  market: TokenMarketData;
  safety: SafetyResult;
  compliance: ComplianceResult;
  holders: HolderData;
  origin?: OriginResult | null;
  evaluation?: string | null;
  createdAt?: string;
}

export default function BriefingDocument({
  address,
  identity,
  market,
  safety,
  compliance,
  holders,
  origin,
  evaluation,
  createdAt,
}: BriefingDocumentProps) {
  return (
    <div
      style={{
        maxWidth: "720px",
        margin: "0 auto",
        padding: "40px 24px",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      }}
    >
      {/* Document header */}
      <div style={{ marginBottom: "36px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <h1
            style={{
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              fontSize: "22px",
              fontWeight: 600,
              color: "#f5f5f5",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            {identity?.name ?? "Token Briefing"}
          </h1>
          {identity?.symbol && (
            <span
              style={{
                fontFamily: "var(--font-geist-mono), monospace",
                fontSize: "13px",
                color: "#555",
              }}
            >
              {identity.symbol}
            </span>
          )}
          <span
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: "11px",
              color: "#4ade80",
              background: "rgba(74,222,128,0.08)",
              border: "1px solid rgba(74,222,128,0.2)",
              borderRadius: "4px",
              padding: "1px 6px",
            }}
          >
            {compliance.token_type.toUpperCase()}
          </span>
        </div>

        <div
          style={{
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: "12px",
            color: "#444",
            marginBottom: "6px",
          }}
        >
          {address}
        </div>

        {createdAt && (
          <div
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: "11px",
              color: "#333",
            }}
          >
            {new Date(createdAt).toISOString().replace("T", " ").slice(0, 19)} UTC
          </div>
        )}
      </div>

      {/* Sections */}
      <MarketSection market={market} />
      <SafetySection safety={safety} />
      <ComplianceSection compliance={compliance} />
      <DistributionSection holders={holders} />
      {origin ? <OriginSection origin={origin} /> : (
        <section style={{ marginBottom: "28px" }}>
          <SectionHeader n="05" title="Origin" source="transfer event log" />
          <PendingRow label="Deployer" />
          <PendingRow label="Funding source" />
        </section>
      )}
      {evaluation ? (
        <AnalystSection text={evaluation} />
      ) : (
        <section style={{ marginBottom: "28px" }}>
          <SectionHeader n="06" title="Analyst Note" source="Claude Sonnet" />
          <p
            style={{
              fontFamily: "var(--font-geist-sans)",
              fontSize: "13px",
              color: "#333",
              fontStyle: "italic",
            }}
          >
            Analyst note not yet generated. Access via the deep briefing endpoint.
          </p>
        </section>
      )}
    </div>
  );
}
