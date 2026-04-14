export interface TokenMarketData {
  price_usd: number;
  volume_24h: number;
  liquidity_usd: number;
  fdv_usd: number | null;
  price_change_24h: number | null;
  pools: PoolData[];
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
  buy_tax_pct: number;
  sell_tax_pct: number;
  honeypot: boolean;
}

export interface ComplianceResult {
  token_type: "tip20" | "erc20";
  policy_id: number | null;
  policy_type: "whitelist" | "blacklist" | "compound" | null;
  policy_admin: string | null;
  paused: boolean;
  supply_cap: string | null;
  current_supply: string;
  headroom_pct: number | null;
  roles: { issuer: string[]; pause: string[]; burn_blocked: string[] };
}

export interface HolderData {
  total_holders: number;
  top5_pct: number;
  top10_pct: number;
  top20_pct: number;
  creator_address: string | null;
  creator_hold_pct: number | null;
  top_holders: { address: string; balance: string; pct: number; label: string | null }[];
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
  deployer: string;
  deployer_tx_count: number;
  deployer_age_days: number;
  funding_source: string | null;
  funding_label: string | null;
  funding_hops: number;
  prior_tokens: { address: string; symbol: string; status: string }[];
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
  spread_bps: number;
  volume_24h: number;
  yield_rate: number;
  opted_in_supply: string;
  risk?: {
    composite: number;
    components: Record<string, number>;
    computed_at: string;
  } | null;
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
  tip20Factory: "0x20fc000000000000000000000000000000000000" as `0x${string}`,
  stablecoinDex: "0xdec0000000000000000000000000000000000000" as `0x${string}`,
  tip403Registry: "0x403c000000000000000000000000000000000000" as `0x${string}`,
  feeManager: "0xfeec000000000000000000000000000000000000" as `0x${string}`,
} as const;
