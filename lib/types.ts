export interface TokenMarketData {
  price_usd: number;
  volume_24h: number;
  liquidity_usd: number;
  fdv_usd: number | null;
  price_change_24h: number | null;
  pools: PoolData[];
  /**
   * Coverage of the market data fetch:
   *   "complete"    — GeckoTerminal returned pool + token data for this address
   *   "unavailable" — GeckoTerminal fetch failed or returned no pools; price/
   *                   volume/liquidity fields should be treated as missing,
   *                   not as "zero market activity"
   */
  coverage: "complete" | "unavailable";
  coverage_note?: string | null;
}

export interface PoolData {
  address: string;
  dex: string;
  base_token: { address: string; symbol: string };
  quote_token: { address: string; symbol: string };
  reserve_usd: number;
  volume_24h: number;
  price_usd: number;
}

export interface SafetyResult {
  score: number;
  verdict: "LOW_RISK" | "CAUTION" | "MEDIUM_RISK" | "HIGH_RISK" | "CRITICAL";
  flags: string[];
  warnings: string[];
  can_buy: boolean;
  can_sell: boolean;
  /**
   * Buy / sell tax percentages. null means NOT MEASURED (eth_call simulation
   * does not report taxes today). Consumers must NOT interpret null as "0%".
   * When measurement becomes available these will become non-null.
   */
  buy_tax_pct: number | null;
  sell_tax_pct: number | null;
  honeypot: boolean;
}

export interface ComplianceResult {
  token_type: "tip20" | "erc20" | "unknown";
  policy_id: number | null;
  policy_type: "whitelist" | "blacklist" | "compound" | null;
  policy_admin: string | null;
  paused: boolean | null;
  supply_cap: string | null;
  current_supply: string | null;
  headroom_pct: number | null;
  roles: { issuer: string[]; pause: string[]; burn_blocked: string[] };
  /**
   * Coverage of the compliance fetch:
   *   "complete"    — on-chain reads succeeded; policy/supply/paused reflect state
   *   "partial"     — token classified but some fields failed to resolve
   *                   (e.g., TIP-20 detected but getPolicy returned no data)
   *   "unavailable" — RPC failure, token classification itself failed
   */
  coverage: "complete" | "partial" | "unavailable";
  coverage_note?: string | null;
}

export interface HolderData {
  total_holders: number;
  top5_pct: number;
  top10_pct: number;
  top20_pct: number;
  creator_address: string | null;
  creator_hold_pct: number | null;
  top_holders: { address: string; balance: string; pct: number; label: string | null }[];
  /**
   * Coverage of the holder enumeration:
   *   "complete"    — every Transfer event was walked, counts are authoritative
   *   "partial"     — log fetch returned results but they may be truncated
   *   "unavailable" — enumeration failed (RPC limits, timeout) OR returned
   *                   zero logs for a token with known positive supply; all
   *                   numeric fields should be treated as "unknown", not "zero"
   */
  coverage: "complete" | "partial" | "unavailable";
  coverage_note?: string | null;
}

export interface IdentityResult {
  name: string;
  symbol: string;
  description: string | null;
  image_url: string | null;
  coingecko_id: string | null;
  defi_llama_protocol: string | null;
  links: Record<string, string>;
}

export interface OriginResult {
  deployer: string | null;
  deployer_tx_count: number | null;
  deployer_age_days: number | null;
  funding_source: string | null;
  funding_label: string | null;
  funding_hops: number;
  prior_tokens: { address: string; symbol: string; status: string }[];
  /**
   * Coverage of the origin analysis:
   *   "complete"    — deployer identified and tx/funding data retrieved
   *   "unavailable" — creator detection failed upstream (holder coverage
   *                   was unavailable), so deployer identity can't be
   *                   inferred; numeric fields are null rather than 0
   */
  coverage: "complete" | "unavailable";
  coverage_note?: string | null;
}

export interface StablecoinData {
  address: string;
  name: string;
  symbol: string;
  currency: string;
  policy_id: number;
  policy_type: string;
  policy_admin: string;
  supply_cap: string;
  current_supply: string;
  headroom_pct: number;
  price_vs_pathusd: number;
  /**
   * DEX spread in basis points vs pathUSD. null means NOT MEASURED
   * (RPC quote call failed, or pathUSD endpoint where spread=0 is trivial).
   * Consumers MUST NOT interpret null as "zero spread".
   */
  spread_bps: number | null;
  volume_24h: number;
  /**
   * Effective APY if opting into reward distribution. null means yield
   * measurement is not yet wired up for this stablecoin — do NOT interpret
   * as "zero yield".
   */
  yield_rate: number | null;
  opted_in_supply: string;
  risk?: {
    composite: number;
    components: Record<string, number>;
    computed_at: string;
  } | null;
  /**
   * Coverage of this stablecoin record:
   *   "complete"    — full matrix populated from on-chain reads
   *   "partial"     — some fields failed; non-null fields are authoritative
   *   "unavailable" — metadata fetch failed; all numeric fields should be
   *                   treated as missing
   */
  coverage?: "complete" | "partial" | "unavailable";
  coverage_note?: string | null;
}

export interface StablecoinFlow {
  from_token: string;
  to_token: string;
  net_flow_usd: number;
  tx_count: number;
  hour: string;
}

export interface BriefingResult {
  id: number;
  token_address: string;
  market: TokenMarketData;
  safety: SafetyResult;
  compliance: ComplianceResult;
  holders: HolderData;
  identity: IdentityResult;
  origin: OriginResult;
  evaluation: string;
  created_at: string;
}

export const TEMPO_ADDRESSES = {
  pathUsd: "0x20c0000000000000000000000000000000000000" as `0x${string}`,
  // USDC.e is the ecosystem-standard MPP payment currency. See tempoxyz/mpp
  // schemas/services.ts — TEMPO_PAYMENT uses USDC.e with 6 decimals. Pellet's
  // MPP-gated endpoints charge in USDC.e to remain compatible with every
  // standard MPP client.
  usdcE: "0x20c000000000000000000000b9537d11c60e8b50" as `0x${string}`,
  tip20Factory: "0x20fc000000000000000000000000000000000000" as `0x${string}`,
  stablecoinDex: "0xdec0000000000000000000000000000000000000" as `0x${string}`,
  tip403Registry: "0x403c000000000000000000000000000000000000" as `0x${string}`,
  feeManager: "0xfeec000000000000000000000000000000000000" as `0x${string}`,
  // ERC-8004 "Trustless Agents" predeploys on Tempo mainnet. Both are EIP-1967
  // upgradeable proxies, so resolve the current implementation slot when
  // building ABI surfaces. Verified on-chain 2026-04-16.
  // Spec: https://eips.ethereum.org/EIPS/eip-8004
  erc8004IdentityRegistry:
    "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as `0x${string}`,
  erc8004ReputationRegistry:
    "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as `0x${string}`,
} as const;
