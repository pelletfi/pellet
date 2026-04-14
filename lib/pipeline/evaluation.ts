import Anthropic from "@anthropic-ai/sdk";
import type {
  TokenMarketData,
  SafetyResult,
  ComplianceResult,
  HolderData,
  IdentityResult,
  OriginResult,
} from "@/lib/types";

const anthropic = new Anthropic();

interface PegStat {
  window: string;
  mean_price: number;
  stddev_price: number;
  max_deviation_bps: number;
  seconds_outside_10bps: number;
}

interface RiskBlock {
  composite: number;
  components: { peg_risk?: number; peg_break_risk?: number; supply_risk?: number; policy_risk?: number };
}

interface ReserveEntry {
  reserve_type: string;
  backing_usd: number | null;
  attestation_source: string | null;
  notes: { issuer?: string; backing_model?: string } | null;
}

interface EvaluationInput {
  address: string;
  name: string;
  symbol: string;
  market: TokenMarketData;
  safety: SafetyResult;
  compliance: ComplianceResult;
  holders: HolderData;
  identity: IdentityResult;
  origin: OriginResult;
  // Optional stablecoin enrichment — only populated for TIP-20 stables
  pegStats?: PegStat[] | null;
  risk?: RiskBlock | null;
  reserves?: { total_backing_usd: number | null; entries: ReserveEntry[] } | null;
  recentPegBreaks?: number | null;
}

export async function evaluate(input: EvaluationInput): Promise<string> {
  const prompt = buildPrompt(input);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return textBlock.text;
}

function buildPrompt(input: EvaluationInput): string {
  const {
    address,
    name,
    symbol,
    market,
    safety,
    compliance,
    holders,
    identity,
    origin,
    pegStats,
    risk,
    reserves,
    recentPegBreaks,
  } = input;

  const marketSummary = formatMarketData(market);
  const safetySummary = formatSafetyData(safety);
  const complianceSummary = formatComplianceData(compliance);
  const holdersSummary = formatHolderData(holders);
  const identitySummary = formatIdentityData(identity);
  const originSummary = formatOriginData(origin);

  const stablecoinBlock = (pegStats || risk || reserves)
    ? `

PEG HEALTH (Pellet stablecoin tracking)
${formatPegStats(pegStats, recentPegBreaks)}

COMPOSITE RISK SCORE
${formatRisk(risk)}

RESERVES & BACKING
${formatReserves(reserves)}`
    : "";

  return `You are a token analyst writing a brief evaluation for a Tempo blockchain token.

Token: ${name} (${symbol})
Address: ${address}

Be factual, neutral, and source-specific. No promotional language. No trading advice.${stablecoinBlock ? " For stablecoin-specific data (peg, reserves, risk), cite specific numbers from the data below." : ""}

MARKET DATA
${marketSummary}

SAFETY & RISK
${safetySummary}

COMPLIANCE & SUPPLY
${complianceSummary}

HOLDERS & DISTRIBUTION
${holdersSummary}

IDENTITY & PROTOCOL
${identitySummary}

ORIGIN & DEPLOYER
${originSummary}${stablecoinBlock}

Write a 2-3 paragraph analyst note. Lead with the most important finding. Note any unusual patterns. End with what to watch. Be concise and direct.`;
}

function formatPegStats(stats: PegStat[] | null | undefined, recentBreaks: number | null | undefined): string {
  if (!stats || stats.length === 0) return "  No peg samples available.";
  const parts: string[] = [];
  for (const s of stats) {
    parts.push(`${s.window} window — mean $${s.mean_price.toFixed(6)}, stddev ${(s.stddev_price * 10_000).toFixed(2)}bps, max deviation ${s.max_deviation_bps.toFixed(2)}bps, ${s.seconds_outside_10bps}s outside 10bps band`);
  }
  if (recentBreaks != null) parts.push(`Detected peg-break events (last 7d): ${recentBreaks}`);
  return parts.map((p) => `  ${p}`).join("\n");
}

function formatRisk(risk: RiskBlock | null | undefined): string {
  if (!risk) return "  Risk score not yet computed.";
  const c = risk.components;
  return `  Composite: ${risk.composite.toFixed(1)} / 100 (higher = more risk)
  Components — peg: ${(c.peg_risk ?? 0).toFixed(0)}, peg-break: ${(c.peg_break_risk ?? 0).toFixed(0)}, supply: ${(c.supply_risk ?? 0).toFixed(0)}, policy: ${(c.policy_risk ?? 0).toFixed(0)}`;
}

function formatReserves(r: { total_backing_usd: number | null; entries: ReserveEntry[] } | null | undefined): string {
  if (!r || r.entries.length === 0) return "  Reserve data not yet curated.";
  const total = r.total_backing_usd != null ? `$${formatNumber(r.total_backing_usd)}` : "unknown";
  const lines = r.entries.map((e) => {
    const issuer = e.notes?.issuer ? ` (issuer: ${e.notes.issuer})` : "";
    const amount = e.backing_usd != null ? `$${formatNumber(e.backing_usd)}` : "unknown";
    return `  ${e.reserve_type}: ${amount}${issuer}${e.attestation_source ? `, attested at ${e.attestation_source}` : ""}`;
  });
  return `  Total Tempo-side backing: ${total}\n${lines.join("\n")}`;
}

function formatMarketData(market: TokenMarketData): string {
  const poolCount = market.pools.length;
  const topPool = market.pools[0];
  const topPoolInfo = topPool
    ? `${topPool.dex} (${topPool.quote_token.symbol} pair)`
    : "N/A";

  return `
Price: $${market.price_usd.toFixed(8)}
24h Volume: $${formatNumber(market.volume_24h)}
Liquidity: $${formatNumber(market.liquidity_usd)}
FDV: ${market.fdv_usd ? `$${formatNumber(market.fdv_usd)}` : "N/A"}
24h Change: ${market.price_change_24h !== null ? `${market.price_change_24h.toFixed(2)}%` : "N/A"}
Pools: ${poolCount} (primary: ${topPoolInfo})`;
}

function formatSafetyData(safety: SafetyResult): string {
  const flagList =
    safety.flags.length > 0 ? safety.flags.join("; ") : "None detected";
  const warningList =
    safety.warnings.length > 0 ? safety.warnings.join("; ") : "None";

  return `
Verdict: ${safety.verdict}
Score: ${safety.score}/100
Can Buy: ${safety.can_buy}
Can Sell: ${safety.can_sell}
Buy Tax: ${safety.buy_tax_pct}%
Sell Tax: ${safety.sell_tax_pct}%
Honeypot: ${safety.honeypot ? "Yes" : "No"}
Flags: ${flagList}
Warnings: ${warningList}`;
}

function formatComplianceData(compliance: ComplianceResult): string {
  const supplyInfo = compliance.supply_cap
    ? `Current: ${formatNumber(parseFloat(compliance.current_supply))} / Cap: ${formatNumber(parseFloat(compliance.supply_cap))} (${compliance.headroom_pct?.toFixed(1)}% headroom)`
    : `Current: ${formatNumber(parseFloat(compliance.current_supply))} (no cap)`;

  return `
Type: ${compliance.token_type}
Paused: ${compliance.paused ? "Yes" : "No"}
Supply: ${supplyInfo}
Policy: ${compliance.policy_type || "None"} ${compliance.policy_id ? `(ID: ${compliance.policy_id})` : ""}
Admin: ${compliance.policy_admin || "N/A"}`;
}

function formatHolderData(holders: HolderData): string {
  const creatorInfo = holders.creator_address
    ? `Creator holds ${holders.creator_hold_pct?.toFixed(2)}%`
    : "Creator not identified";

  return `
Total Holders: ${holders.total_holders.toLocaleString()}
Top 5%: ${holders.top5_pct.toFixed(2)}% of supply
Top 10%: ${holders.top10_pct.toFixed(2)}% of supply
Top 20%: ${holders.top20_pct.toFixed(2)}% of supply
${creatorInfo}
Top 3 Holders: ${
    holders.top_holders
      .slice(0, 3)
      .map((h) => `${h.label || h.address.slice(0, 6)}... (${h.pct.toFixed(2)}%)`)
      .join("; ") || "N/A"
  }`;
}

function formatIdentityData(identity: IdentityResult): string {
  const description = identity.description ? identity.description.slice(0, 100) : "N/A";
  const protocol = identity.defi_llama_protocol || "Not identified";
  const coingecko = identity.coingecko_id ? `Listed (${identity.coingecko_id})` : "Not listed";

  return `
Description: ${description}${identity.description && identity.description.length > 100 ? "..." : ""}
Protocol: ${protocol}
CoinGecko: ${coingecko}
Links: ${Object.keys(identity.links).length > 0 ? Object.keys(identity.links).join(", ") : "None"}`;
}

function formatOriginData(origin: OriginResult): string {
  const deployerLabel = origin.deployer.slice(0, 6) + "...";
  const fundingLabel = origin.funding_label
    ? `${origin.funding_label} (${origin.funding_hops} hop${origin.funding_hops !== 1 ? "s" : ""})`
    : `Unidentified (${origin.funding_hops} hop${origin.funding_hops !== 1 ? "s" : ""})`;

  const priorTokensInfo =
    origin.prior_tokens.length > 0
      ? origin.prior_tokens.slice(0, 3).map((t) => `${t.symbol} (${t.status})`).join("; ")
      : "None";

  return `
Deployer: ${deployerLabel}
Deployer Age: ${origin.deployer_age_days} days
Deployer TX Count: ${origin.deployer_tx_count}
Funding Source: ${fundingLabel}
Prior Tokens: ${priorTokensInfo}`;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(2) + "B";
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(2) + "K";
  }
  return num.toFixed(2);
}
