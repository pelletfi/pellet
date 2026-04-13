import { StatsBar } from "@/components/StatsBar";
import { HeroTerminal } from "./HeroTerminal";
import { getPools } from "@/lib/gecko";
import { getAllStablecoins } from "@/lib/pipeline/stablecoins";

// ---------------------------------------------------------------------------
// Data fetching — call lib functions directly to avoid self-fetch during SSR
// ---------------------------------------------------------------------------

async function getStats() {
  try {
    const [poolsRes, stablecoins] = await Promise.all([
      getPools(1),
      getAllStablecoins(),
    ]);

    // Deduplicate pools by base token address
    const seen = new Set<string>();
    const tokens: { price_usd: number; liquidity_usd: number; volume_24h: number }[] = [];

    for (const pool of poolsRes.data ?? []) {
      const baseId = pool.relationships?.base_token?.data?.id;
      if (!baseId) continue;

      const addr = baseId.includes("_") ? baseId.split("_").pop()! : baseId;
      if (!addr || seen.has(addr.toLowerCase())) continue;
      seen.add(addr.toLowerCase());

      tokens.push({
        price_usd: parseFloat(pool.attributes.base_token_price_usd ?? "0"),
        liquidity_usd: parseFloat(pool.attributes.reserve_in_usd ?? "0"),
        volume_24h: parseFloat(pool.attributes.volume_usd?.h24 ?? "0"),
      });
    }

    const totalVolume = tokens.reduce((sum, t) => sum + (t.volume_24h || 0), 0);
    const totalLiquidity = tokens.reduce((sum, t) => sum + (t.liquidity_usd || 0), 0);

    return {
      tokenCount: tokens.length,
      stablecoinCount: stablecoins.length,
      volume24h: totalVolume,
      totalLiquidity,
    };
  } catch {
    return { tokenCount: 0, stablecoinCount: 0, volume24h: 0, totalLiquidity: 0 };
  }
}

function fmtLarge(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n === 0) return "$0";
  return `$${n.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function HomePage() {
  const stats = await getStats();

  return (
    <>
      {/* Hero — split layout */}
      <div className="hero-grid">
        {/* Left — thesis */}
        <div
          className="hero-left"
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            maxWidth: "640px",
            marginLeft: "auto",
          }}
        >
          {/* Overline */}
          <div
            style={{
              marginBottom: "24px",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--color-text-tertiary)",
              }}
            >
              Built on
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/tempo-logo-white.svg" alt="Tempo" height={12} style={{ opacity: 0.5, marginLeft: 6 }} />
          </div>

          {/* H1 */}
          <h1
            className="hero-h1"
            style={{
              fontSize: "32px",
              fontWeight: 600,
              letterSpacing: "-0.025em",
              lineHeight: 1.2,
              color: "var(--color-text-primary)",
            }}
          >
            MPP-Native Compute
          </h1>

          {/* Body */}
          <p
            style={{
              fontSize: "15px",
              lineHeight: 1.65,
              color: "var(--color-text-secondary)",
              marginBottom: "36px",
              maxWidth: "460px",
            }}
          >
            The first payments chain deserves more than a block explorer. Pellet
            examines every token, tracks every stablecoin, and maps every payment
            service — natively, from day one.
          </p>

          {/* CTAs */}
          <div className="hero-ctas">
            <a href="/tokens" className="btn-primary">
              Explore tokens
            </a>
            <a href="/about" className="btn-secondary">
              Read the thesis
            </a>
          </div>
        </div>

        {/* Right — terminal window */}
        <div className="hero-terminal-area">
          <div className="terminal-window">
            {/* Title bar */}
            <div className="terminal-titlebar">
              <div style={{ display: "flex", gap: 6 }}>
                <span className="terminal-dot" style={{ background: "#ff5f57" }} />
                <span className="terminal-dot" style={{ background: "#febc2e" }} />
                <span className="terminal-dot" style={{ background: "#28c840" }} />
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--color-text-quaternary)",
                  position: "absolute",
                  left: "50%",
                  transform: "translateX(-50%)",
                }}
              >
                pellet
              </span>
            </div>
            {/* Terminal content */}
            <div style={{ flex: 1, overflow: "auto" }}>
              <HeroTerminal />
            </div>
            {/* Footer link */}
            <div
              style={{
                padding: "8px 16px",
                textAlign: "right",
                borderTop: "1px solid var(--color-border-subtle)",
              }}
            >
              <a
                href="/terminal"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--color-text-quaternary)",
                  textDecoration: "none",
                }}
              >
                Try the terminal &rarr;
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <StatsBar
        stats={[
          { label: "Tokens Tracked", value: String(stats.tokenCount) },
          { label: "Stablecoins", value: String(stats.stablecoinCount) },
          { label: "24h Volume", value: fmtLarge(stats.volume24h) },
          { label: "Total Liquidity", value: fmtLarge(stats.totalLiquidity) },
        ]}
      />
    </>
  );
}
