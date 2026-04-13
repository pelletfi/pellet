import { notFound } from "next/navigation";
import Nav from "@/components/Nav";

export default async function BriefingPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;

  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    notFound();
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <Nav />

      <main
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          padding: "48px 24px",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "40px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "16px",
              padding: "3px 10px",
              background: "rgba(74,222,128,0.08)",
              border: "1px solid rgba(74,222,128,0.2)",
              borderRadius: "5px",
            }}
          >
            <span
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: "11px",
                color: "#4ade80",
                letterSpacing: "0.04em",
              }}
            >
              $0.05 · MPP
            </span>
          </div>

          <h1
            style={{
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              fontSize: "26px",
              fontWeight: 600,
              color: "#f5f5f5",
              letterSpacing: "-0.025em",
              marginBottom: "10px",
            }}
          >
            Deep Briefing
          </h1>

          <p
            style={{
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              fontSize: "14px",
              color: "#888",
              lineHeight: 1.65,
              marginBottom: "6px",
            }}
          >
            A full Pellet Briefing aggregates on-chain and market data into one sourced,
            timestamped document — market, safety, compliance, distribution, origin, and
            an analyst note synthesized by Claude Sonnet.
          </p>

          <div
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: "12px",
              color: "#444",
            }}
          >
            {address}
          </div>
        </div>

        {/* What's included */}
        <section
          style={{
            background: "#13131a",
            border: "1px solid #1a1a1f",
            borderRadius: "10px",
            padding: "24px",
            marginBottom: "28px",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-geist-sans)",
              fontSize: "11px",
              fontWeight: 600,
              color: "#555",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "16px",
            }}
          >
            What&apos;s included
          </h2>

          {[
            { n: "01", label: "Market", detail: "Price, volume, liquidity, FDV, pools — GeckoTerminal" },
            { n: "02", label: "Safety", detail: "Bytecode patterns, transfer simulation, honeypot detection" },
            { n: "03", label: "Compliance", detail: "TIP-20 token type, TIP-403 policy, supply cap, headroom" },
            { n: "04", label: "Distribution", detail: "Holder count, top 5/10/20 %, top 10 holders with labels" },
            { n: "05", label: "Origin", detail: "Deployer wallet, funding source, prior token history" },
            { n: "06", label: "Analyst Note", detail: "Claude Sonnet synthesis of all findings" },
          ].map(({ n, label, detail }) => (
            <div
              key={n}
              style={{
                display: "flex",
                gap: "14px",
                padding: "10px 0",
                borderBottom: "1px solid #111115",
                alignItems: "flex-start",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-geist-mono), monospace",
                  fontSize: "11px",
                  color: "#444",
                  paddingTop: "1px",
                  flexShrink: 0,
                  minWidth: "22px",
                }}
              >
                {n}
              </span>
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-geist-sans)",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#e8e8e8",
                    marginBottom: "2px",
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-geist-sans)",
                    fontSize: "12px",
                    color: "#555",
                  }}
                >
                  {detail}
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* API access instructions */}
        <section
          style={{
            marginBottom: "28px",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-geist-sans)",
              fontSize: "14px",
              fontWeight: 600,
              color: "#e8e8e8",
              marginBottom: "12px",
            }}
          >
            Access via API
          </h2>
          <p
            style={{
              fontFamily: "var(--font-geist-sans)",
              fontSize: "13px",
              color: "#888",
              lineHeight: 1.65,
              marginBottom: "16px",
            }}
          >
            Deep Briefings are delivered as machine-readable JSON via the{" "}
            <code
              style={{
                fontFamily: "var(--font-geist-mono), monospace",
                fontSize: "12px",
                color: "#c4c4c4",
                background: "#1a1a1f",
                borderRadius: "3px",
                padding: "1px 5px",
              }}
            >
              /v1/tokens/{"{address}"}/briefing
            </code>{" "}
            endpoint, paid per-call via Tempo MPP.
          </p>

          {/* mppx command */}
          <div
            style={{
              background: "#0a0a0d",
              border: "1px solid #1a1a1f",
              borderRadius: "8px",
              padding: "16px 18px",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-geist-sans)",
                fontSize: "10px",
                color: "#444",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              CLI — mppx
            </div>
            <code
              style={{
                fontFamily: "var(--font-geist-mono), monospace",
                fontSize: "13px",
                color: "#c4c4c4",
                display: "block",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {`mppx GET https://pellet.tempo/v1/tokens/${address}/briefing`}
            </code>
          </div>

          <div
            style={{
              background: "#0a0a0d",
              border: "1px solid #1a1a1f",
              borderRadius: "8px",
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-geist-sans)",
                fontSize: "10px",
                color: "#444",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              curl with MPP header
            </div>
            <code
              style={{
                fontFamily: "var(--font-geist-mono), monospace",
                fontSize: "12px",
                color: "#888",
                display: "block",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {`curl -H "X-MPP-Payment: <signed-payment>" \\\n  https://pellet.tempo/v1/tokens/${address}/briefing`}
            </code>
          </div>
        </section>

        {/* Back link */}
        <a
          href={`/token/${address}`}
          style={{
            fontFamily: "var(--font-geist-sans)",
            fontSize: "13px",
            color: "#555",
            textDecoration: "none",
          }}
        >
          ← Back to token
        </a>
      </main>
    </div>
  );
}
