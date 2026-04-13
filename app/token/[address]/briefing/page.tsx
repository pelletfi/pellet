import { notFound } from "next/navigation";

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
    <main className="page-container-about" style={{ maxWidth: "720px" }}>
      {/* Header */}
      <div style={{ marginBottom: "40px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            marginBottom: "16px",
            padding: "3px 10px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "5px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--color-positive)",
              letterSpacing: "0.04em",
            }}
          >
            $0.05 · MPP
          </span>
        </div>

        <h1
          style={{
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontSize: "28px",
            fontWeight: 700,
            color: "var(--color-text)",
            letterSpacing: "-0.025em",
            marginBottom: "10px",
          }}
        >
          Deep Briefing
        </h1>

        <p
          style={{
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontSize: "17px",
            color: "var(--color-secondary)",
            lineHeight: 1.7,
            marginBottom: "6px",
          }}
        >
          A full Pellet Briefing aggregates on-chain and market data into one sourced,
          timestamped document — market, safety, compliance, distribution, origin, and
          an analyst note synthesized by Claude Sonnet.
        </p>

        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "var(--color-muted)",
          }}
        >
          {address}
        </div>
      </div>

      {/* What's included */}
      <section
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "8px",
          padding: "24px",
          marginBottom: "28px",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            fontWeight: 600,
            color: "var(--color-muted)",
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
              borderBottom: "1px solid #f5f5f5",
              alignItems: "flex-start",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--color-muted)",
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
                  fontFamily: "var(--font-inter)",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--color-text)",
                  marginBottom: "2px",
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-inter)",
                  fontSize: "12px",
                  color: "var(--color-secondary)",
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
            fontFamily: "var(--font-inter)",
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--color-text)",
            marginBottom: "12px",
          }}
        >
          Access via API
        </h2>
        <p
          style={{
            fontFamily: "var(--font-inter)",
            fontSize: "13px",
            color: "var(--color-secondary)",
            lineHeight: 1.65,
            marginBottom: "16px",
          }}
        >
          Deep Briefings are delivered as machine-readable JSON via the{" "}
          <code
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "var(--color-text)",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
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
            background: "var(--color-terminal)",
            borderRadius: "8px",
            padding: "16px 18px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "#888",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            CLI — mppx
          </div>
          <code
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
              color: "var(--color-terminal-text)",
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
            background: "var(--color-terminal)",
            borderRadius: "8px",
            padding: "16px 18px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "#888",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            curl with MPP header
          </div>
          <code
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "#aaa",
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
          fontFamily: "var(--font-inter)",
          fontSize: "13px",
          color: "var(--color-secondary)",
          textDecoration: "none",
        }}
      >
        ← Back to token
      </a>
    </main>
  );
}
