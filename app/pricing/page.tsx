import Link from "next/link";

export const metadata = {
  title: "Pricing — Pellet",
  description: "Free reads, MPP per-call, or Pellet Pro for $49/mo unlimited.",
};

const tiers = [
  {
    name: "Free",
    price: "$0",
    cadence: "no auth required",
    description: "Live data, no rate-limits worth mentioning. Suitable for any read-only use.",
    features: [
      "All free GET endpoints (peg, peg-events, risk, reserves, roles, flow-anomalies, system/health)",
      "60 req/min/IP",
      "Status page + uptime probe",
      "MCP server (free tools)",
    ],
    cta: { label: "Start exploring", href: "/explorer" },
    accent: false,
  },
  {
    name: "MPP",
    price: "$0.05",
    cadence: "per call",
    description: "Pay per request via the Micropayment Protocol. No accounts, no API keys — just sign and call.",
    features: [
      "Pellet Assay deep briefings ($0.05 pathUSD per call)",
      "All free endpoints included",
      "Settled on Tempo at the protocol layer",
      "Works with mppx CLI or @pelletfi/mcp",
    ],
    cta: { label: "Try via MCP", href: "/docs/mcp" },
    accent: false,
  },
  {
    name: "Pellet Pro",
    price: "$49",
    cadence: "per month",
    description: "Unlimited access for high-volume users, agents, and teams. Predictable monthly bill, no per-request math.",
    features: [
      "Unlimited briefings",
      "Higher rate limits (10k req/min/key)",
      "Webhook subscriptions (peg breaks, anomalies, system events)",
      "Priority support",
      "API key auth (no MPP signing required)",
    ],
    cta: { label: "Get a key", href: "mailto:hello@pelletfi.com?subject=Pellet%20Pro%20signup" },
    accent: true,
  },
];

export default function PricingPage() {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px 80px" }}>
      <header style={{ marginBottom: 56, textAlign: "center" }}>
        <h1
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 56,
            fontWeight: 400,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            marginBottom: 16,
            color: "var(--color-text-primary)",
          }}
        >
          Three ways to pay.
          <br />
          <em style={{ color: "var(--color-text-secondary)" }}>One product.</em>
        </h1>
        <p style={{ fontSize: 16, color: "var(--color-text-tertiary)", maxWidth: 560, margin: "0 auto", lineHeight: 1.6 }}>
          Same data either way. Pick what fits your usage and integration style.
        </p>
      </header>

      <div className="pricing-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {tiers.map((tier) => (
          <div
            key={tier.name}
            style={{
              padding: 28,
              border: tier.accent ? "1px solid var(--color-text-tertiary)" : "1px solid var(--color-border-subtle)",
              borderRadius: 10,
              background: tier.accent ? "rgba(255,255,255,0.025)" : "transparent",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--color-text-quaternary)",
                marginBottom: 16,
              }}
            >
              {tier.name}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
              <span
                style={{
                  fontFamily: "'Instrument Serif', Georgia, serif",
                  fontSize: 44,
                  fontWeight: 400,
                  color: "var(--color-text-primary)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                {tier.price}
              </span>
              <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>{tier.cadence}</span>
            </div>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: "var(--color-text-secondary)",
                marginBottom: 24,
              }}
            >
              {tier.description}
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 10 }}>
              {tier.features.map((f) => (
                <li
                  key={f}
                  style={{
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "var(--color-text-tertiary)",
                    paddingLeft: 16,
                    position: "relative",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 7,
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: "var(--color-text-quaternary)",
                    }}
                  />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={tier.cta.href}
              style={{
                marginTop: "auto",
                padding: "10px 16px",
                borderRadius: 6,
                background: tier.accent ? "var(--color-text-primary)" : "transparent",
                color: tier.accent ? "var(--color-bg-base)" : "var(--color-text-primary)",
                border: tier.accent ? "none" : "1px solid var(--color-border-default)",
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              {tier.cta.label} →
            </Link>
          </div>
        ))}
      </div>

      <p
        style={{
          marginTop: 56,
          textAlign: "center",
          fontSize: 12,
          color: "var(--color-text-quaternary)",
          fontFamily: "var(--font-mono)",
        }}
      >
        Same tier breakdown lives in <Link href="/docs/pricing" style={{ color: "var(--color-text-tertiary)" }}>/docs/pricing</Link> for AI agents to reference.
      </p>
    </div>
  );
}
