import Image from "next/image";

// ---------------------------------------------------------------------------
// Pixel strip helper
// ---------------------------------------------------------------------------

function PixelStrip({ colors }: { colors: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "row" as const, gap: 3 }}>
      {colors.map((color, i) => (
        <div
          key={i}
          style={{
            width: 8,
            height: 8,
            backgroundColor: color,
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Style constants
// ---------------------------------------------------------------------------

const topPixels = [
  "#0a0a0a", "#333", "#555", "#888", "#aaa",
  "#ccc",
  "#aaa", "#888", "#555", "#333", "#0a0a0a",
];

const bottomPixels = [
  "#ccc", "#aaa", "#888", "#555", "#333",
  "#0a0a0a",
  "#333", "#555", "#888", "#aaa", "#ccc",
];

const h2Style: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 600,
  color: "var(--color-text)",
  marginTop: 40,
  marginBottom: 16,
  letterSpacing: "-0.3px",
};

const pStyle: React.CSSProperties = {
  fontSize: 17,
  color: "#555",
  lineHeight: 1.8,
  margin: "0 0 20px",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AboutPage() {
  return (
    <main className="page-container-about">
      {/* Top pixel strip */}
      <div style={{ marginBottom: 32 }}>
        <PixelStrip colors={topPixels} />
      </div>

      {/* Overline */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          textTransform: "uppercase" as const,
          letterSpacing: 2,
          color: "var(--color-muted)",
          marginBottom: 24,
        }}
      >
        <span>About Pellet &mdash; Built on</span>
        <Image
          src="/tempo-logo.svg"
          alt="Tempo"
          width={56}
          height={14}
          style={{ opacity: 0.5 }}
        />
      </div>

      {/* H1 */}
      <h1 className="about-h1">
        The intelligence layer for the payments chain.
      </h1>

      {/* Body */}
      <div>
        <p style={pStyle}>
          Tempo is the first blockchain designed for payments at scale &mdash;
          incubated by Stripe and Paradigm, launched March 2026. It introduced
          TIP-20 stablecoins with enshrined compliance, a native DEX, and the
          Micropayment Protocol for machine-to-machine payments.
        </p>

        <p style={pStyle}>
          The chain is live. Tokens are trading. Stablecoins are flowing. MPP
          services are coming online. But there&apos;s no analytical layer
          making any of it legible.
        </p>

        <p
          style={{
            ...pStyle,
            color: "var(--color-text)",
            fontWeight: 500,
          }}
        >
          That&apos;s what Pellet is building.
        </p>

        <p style={pStyle}>
          We examine every token on Tempo &mdash; safety, compliance, holder
          distribution, deployer origin. We track every TIP-20 stablecoin
          &mdash; peg stability, supply headroom, cross-pair flows. We map
          every MPP service as the machine economy takes shape.
        </p>

        <h2 style={h2Style}>Why Tempo</h2>

        <p style={pStyle}>
          Most chains optimize for speed or cost. Tempo optimizes for payments.
          That means enshrined stablecoin standards, built-in compliance
          policies, and a micropayment protocol that lets machines pay machines
          at the HTTP layer.
        </p>

        <p style={pStyle}>
          This isn&apos;t another EVM fork. Tempo&apos;s architecture creates
          data structures that don&apos;t exist anywhere else &mdash; TIP-403
          compliance policies, enshrined DEX orderbooks, MPP payment graphs.
          Pellet is built to read these native structures, not to retrofit
          generic tools.
        </p>

        <h2 style={h2Style}>How it works</h2>

        <p style={pStyle}>
          Pellet runs an 8-stage pipeline on every token: market data from the
          enshrined DEX, bytecode safety analysis, TIP-403 compliance
          verification, holder distribution from event replay, identity
          resolution, deployer origin tracing, and AI-powered synthesis.
        </p>

        <p style={pStyle}>
          Deep briefings are paid via MPP &mdash; $0.05 in pathUSD, settled at
          the protocol layer. No accounts, no API keys. Just a payment and a
          report.
        </p>

        <p style={pStyle}>
          Everything is available as an API, an MCP server for AI assistants,
          and this site.
        </p>

        <h2 style={h2Style}>Built from day one</h2>

        <p style={pStyle}>
          We didn&apos;t wait for the ecosystem to mature. Pellet was tracking
          Tempo from the first block. When the chain has 10 tokens, we examine
          all 10. When it has 10,000, we&apos;ll examine all 10,000. First
          mover, native builder, here to stay.
        </p>
      </div>

      {/* Bottom pixel strip */}
      <div style={{ marginTop: 64 }}>
        <PixelStrip colors={bottomPixels} />
      </div>
    </main>
  );
}
