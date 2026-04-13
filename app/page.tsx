import Image from "next/image";
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
          {/* Pixel strip */}
          <div style={{ display: "flex", gap: "3px", marginBottom: "24px" }}>
            {["#0a0a0a","#333","#555","#888","#aaa","#ccc","#aaa","#888","#555","#333","#0a0a0a"].map((c, i) => (
              <div key={i} style={{ width: 6, height: 6, background: c, imageRendering: "pixelated" as const }} />
            ))}
          </div>

          {/* Overline */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "24px",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                color: "var(--color-muted)",
              }}
            >
              Built on
            </span>
            <Image
              src="/tempo-logo.svg"
              alt="Tempo"
              width={72}
              height={20}
              style={{ opacity: 0.7 }}
            />
          </div>

          {/* H1 */}
          <h1
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "40px",
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: "-0.025em",
              color: "var(--color-text)",
              marginBottom: "20px",
            }}
          >
            We&apos;re building the intelligence Tempo needs.
          </h1>

          {/* Body */}
          <p
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "16px",
              lineHeight: 1.65,
              color: "var(--color-secondary)",
              marginBottom: "36px",
              maxWidth: "480px",
            }}
          >
            The first payments chain deserves more than a block explorer. Pellet
            examines every token, tracks every stablecoin, and maps every payment
            service — natively, from day one.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: "12px" }}>
            <a
              href="/tokens"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "12px 28px",
                background: "var(--color-text)",
                color: "var(--color-bg)",
                fontFamily: "var(--font-inter)",
                fontSize: "14px",
                fontWeight: 500,
                borderRadius: "6px",
                textDecoration: "none",
                transition: "opacity 0.15s",
              }}
            >
              Explore tokens
            </a>
            <a
              href="/about"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "12px 28px",
                background: "transparent",
                color: "var(--color-text)",
                fontFamily: "var(--font-inter)",
                fontSize: "14px",
                fontWeight: 500,
                borderRadius: "6px",
                border: "1px solid var(--color-border)",
                textDecoration: "none",
                transition: "border-color 0.15s",
              }}
            >
              Read the thesis
            </a>
          </div>
        </div>

        {/* Right — terminal */}
        <div
          style={{
            background: "var(--color-terminal)",
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          <div style={{ flex: 1 }}>
            <HeroTerminal />
          </div>
          <div
            style={{
              padding: "16px 24px",
              textAlign: "right",
            }}
          >
            <a
              href="/terminal"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                color: "var(--color-terminal-muted)",
                textDecoration: "none",
                transition: "color 0.15s",
              }}
            >
              Try the terminal &rarr;
            </a>
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
