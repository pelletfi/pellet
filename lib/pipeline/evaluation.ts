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
  } = input;

  const marketSummary = formatMarketData(market);
  const safetySummary = formatSafetyData(safety);
  const complianceSummary = formatComplianceData(compliance);
  const holdersSummary = formatHolderData(holders);
  const identitySummary = formatIdentityData(identity);
  const originSummary = formatOriginData(origin);

  return `You are a token analyst writing a brief evaluation for a Tempo blockchain token.

Token: ${name} (${symbol})
Address: ${address}

Be factual, neutral, and source-specific. No promotional language. No trading advice.

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
${originSummary}

Write a 2-3 paragraph analyst note. Lead with the most important finding. Note any unusual patterns. End with what to watch. Be concise and direct.`;
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
