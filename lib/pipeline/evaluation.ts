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

OLI DISCIPLINE — READ CAREFULLY:
This briefing is Open-Ledger Intelligence (OLI) output. Pellet's core tenet
is measurement over inference. Apply these rules strictly:

1. When a section is labeled COVERAGE: UNAVAILABLE, treat its fields as
   MISSING DATA, not as zero values. Do NOT write phrases like "has zero
   holders" or "deployer is unknown" when coverage is unavailable — say
   "holder distribution data unavailable for this token" or "deployer
   identity not yet indexed".

2. When coverage is unavailable, explicitly note the scope of missing data
   and do NOT synthesize a verdict from absent signals. A null field is
   NOT evidence against a token.

3. For TIP-20 tokens (Tempo's first-class stablecoin standard), "honeypot"
   is a compliance flag, not a trap. TIP-20 exposes pause + allowlist /
   blocklist policy as explicit state — "paused" or "blocklist-enforced"
   is not equivalent to "malicious". Report compliance posture factually.

4. Do NOT conflate missing data with adverse findings. If safety is clean
   but holder coverage is unavailable, say so; do not let absence of one
   signal infect the interpretation of another.

5. Be factual, neutral, and source-specific. No promotional language. No
   trading advice.${stablecoinBlock ? " For stablecoin-specific data (peg, reserves, risk), cite specific numbers." : ""}

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

Write a 2-3 paragraph analyst note. Lead with the most important VERIFIED
finding (skip sections with unavailable coverage for the opening line). Note
any unusual patterns in VERIFIED data. Close with what to watch, and if any
coverage gaps exist, note them as open measurement questions rather than as
risks in themselves. Be concise and direct.`;
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
  if (market.coverage === "unavailable") {
    return `
COVERAGE: UNAVAILABLE
Note: ${market.coverage_note ?? "GeckoTerminal market-data fetch failed."}
Price, volume, liquidity, and pool data are not available for this token. The numeric fields below are defaults for a missing response, not measurements.`;
  }

  const poolCount = market.pools.length;
  const topPool = market.pools[0];
  // Pool endpoints don't populate symbol — only show quote pair if we have an
  // address. (Empty-string symbol is "unmeasured", not "real empty symbol".)
  const topPoolInfo = topPool
    ? `${topPool.dex}${topPool.quote_token.address ? ` via ${topPool.quote_token.address.slice(0, 12)}…` : ""}`
    : "N/A";

  return `
COVERAGE: COMPLETE
Price: $${market.price_usd.toFixed(8)}
24h Volume: $${formatNumber(market.volume_24h)}
Liquidity: $${formatNumber(market.liquidity_usd)}
FDV: ${market.fdv_usd ? `$${formatNumber(market.fdv_usd)}` : "N/A"}
24h Change: ${market.price_change_24h !== null ? `${market.price_change_24h.toFixed(2)}%` : "[unmeasured — GeckoTerminal token endpoint doesn't expose 24h change for Tempo]"}
Pools: ${poolCount} (primary: ${topPoolInfo})`;
}

function formatSafetyData(safety: SafetyResult): string {
  const flagList =
    safety.flags.length > 0 ? safety.flags.join("; ") : "None detected";
  const warningList =
    safety.warnings.length > 0 ? safety.warnings.join("; ") : "None";
  // Tax fields are null when not measured — do NOT render as "0%" to the LLM.
  const buyTax =
    safety.buy_tax_pct !== null ? `${safety.buy_tax_pct}%` : "[not measured]";
  const sellTax =
    safety.sell_tax_pct !== null ? `${safety.sell_tax_pct}%` : "[not measured]";

  return `
Verdict: ${safety.verdict}
Score: ${safety.score}/100
Can Buy: ${safety.can_buy}
Can Sell: ${safety.can_sell}
Buy Tax: ${buyTax}
Sell Tax: ${sellTax}
Honeypot: ${safety.honeypot ? "Yes" : "No"}
Flags: ${flagList}
Warnings: ${warningList}`;
}

function formatComplianceData(compliance: ComplianceResult): string {
  if (compliance.coverage === "unavailable") {
    return `
COVERAGE: UNAVAILABLE
Note: ${compliance.coverage_note ?? "Compliance read failed."}
Policy state, supply, and pause status are not available. Do not infer absence.`;
  }

  const coverageLine = compliance.coverage === "partial"
    ? `COVERAGE: PARTIAL — ${compliance.coverage_note ?? "policy lookup did not resolve"}`
    : "COVERAGE: COMPLETE";

  const currentSupplyNum =
    compliance.current_supply !== null ? parseFloat(compliance.current_supply) : null;
  const supplyInfo = compliance.supply_cap
    ? `Current: ${currentSupplyNum !== null ? formatNumber(currentSupplyNum) : "[unmeasured]"} / Cap: ${formatNumber(parseFloat(compliance.supply_cap))} (${compliance.headroom_pct?.toFixed(1) ?? "?"}% headroom)`
    : `Current: ${currentSupplyNum !== null ? formatNumber(currentSupplyNum) : "[unmeasured]"} (no cap)`;

  const pausedLine =
    compliance.paused === null
      ? "Paused: [unmeasured]"
      : `Paused: ${compliance.paused ? "Yes" : "No"}`;

  const policyLine =
    compliance.policy_id !== null || compliance.policy_type !== null
      ? `Policy: ${compliance.policy_type || "None"} ${compliance.policy_id !== null ? `(ID: ${compliance.policy_id})` : ""}`
      : "Policy: [not registered in TIP-403 / lookup unavailable]";

  const adminLine =
    compliance.policy_admin
      ? `Admin: ${compliance.policy_admin}`
      : "Admin: [not resolved]";

  return `
${coverageLine}
Type: ${compliance.token_type}
${pausedLine}
Supply: ${supplyInfo}
${policyLine}
${adminLine}`;
}

function formatHolderData(holders: HolderData): string {
  if (holders.coverage === "unavailable") {
    return `
COVERAGE: UNAVAILABLE
Note: ${holders.coverage_note ?? "Transfer-event enumeration did not complete."}
Holder counts, concentration percentages, and creator identity cannot be reported for this token. This is a measurement gap, not an indication of zero holders.`;
  }

  const creatorInfo = holders.creator_address
    ? `Creator holds ${holders.creator_hold_pct?.toFixed(2)}%`
    : "Creator not identified";

  const coverageLine =
    holders.coverage === "partial"
      ? `COVERAGE: PARTIAL — ${holders.coverage_note ?? "reconstruction diverged from on-chain supply"}`
      : "COVERAGE: COMPLETE";

  return `
${coverageLine}
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
  if (origin.coverage === "unavailable") {
    return `
COVERAGE: UNAVAILABLE
Note: ${origin.coverage_note ?? "Deployer lookup could not complete."}
Deployer identity, tx count, age, and funding source cannot be reported. This is a measurement gap, not confirmation of an absent or suspicious deployer.`;
  }

  const deployerLabel = origin.deployer
    ? origin.deployer.slice(0, 6) + "..."
    : "N/A";
  const fundingLabel = origin.funding_label
    ? `${origin.funding_label} (${origin.funding_hops} hop${origin.funding_hops !== 1 ? "s" : ""})`
    : `Unidentified (${origin.funding_hops} hop${origin.funding_hops !== 1 ? "s" : ""})`;

  const priorTokensInfo =
    origin.prior_tokens.length > 0
      ? origin.prior_tokens.slice(0, 3).map((t) => `${t.symbol} (${t.status})`).join("; ")
      : "None";

  return `
COVERAGE: COMPLETE
Deployer: ${deployerLabel}
Deployer Age: ${origin.deployer_age_days !== null ? `${origin.deployer_age_days} days` : "[not measured — block-to-timestamp lookup not wired up]"}
Deployer TX Count: ${origin.deployer_tx_count !== null ? origin.deployer_tx_count.toLocaleString() : "[RPC read failed]"}
Funding Source: ${fundingLabel}
Prior Tokens: ${priorTokensInfo}${origin.coverage_note ? `\nNote: ${origin.coverage_note}` : ""}`;
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
