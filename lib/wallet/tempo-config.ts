// Tempo chain + service constants. v0 ships Moderato (testnet) only;
// Presto (mainnet) constants are present so chain branching code lights
// up cleanly when we flip to mainnet.
//
// Source of truth verified 2026-04-29 against:
//   docs.tempo.xyz/quickstart/connection-details
//   tokenlist.tempo.xyz/list/<chainId>

export const TEMPO_CHAIN_IDS = {
  PRESTO_MAINNET: 4217,
  MODERATO_TESTNET: 42431,
} as const;

export type TempoChainId = (typeof TEMPO_CHAIN_IDS)[keyof typeof TEMPO_CHAIN_IDS];

type ChainConfig = {
  chainId: number;
  name: string;
  rpcUrl: string;
  sponsorUrl: string | null;
  explorerUrl: string;
  /** Canonical USDC.e on this chain. NOTE: differs per-chain — never hardcode mainnet on testnet. */
  usdcE: `0x${string}`;
  /** Pellet's testnet demo stable. On mainnet this is just USDC.e. */
  demoStable: `0x${string}`;
  usdt0: `0x${string}` | null;
};

const MODERATO: ChainConfig = {
  chainId: TEMPO_CHAIN_IDS.MODERATO_TESTNET,
  name: "Moderato",
  rpcUrl: "https://rpc.moderato.tempo.xyz",
  sponsorUrl: "https://sponsor.moderato.tempo.xyz",
  // Block explorer URL the docs claim (`explore.moderato.tempo.xyz`) does
  // NOT resolve — verified 2026-04-29. Use this one instead.
  explorerUrl: "https://explore.testnet.tempo.xyz",
  // ⚠ Different from mainnet — see tokenlist.tempo.xyz/list/42431.
  usdcE: "0x20c0000000000000000000009e8d7eb59b783726",
  // No public USDC.e faucet on Moderato; pathUSD is the canonical test
  // stable for end-to-end demos. Funded via tempo_fundAddress RPC method.
  demoStable: "0x20c0000000000000000000000000000000000001", // AlphaUSD — on-chain symbol; displayed as "pathUSD" in UI
  usdt0: null,
};

const PRESTO: ChainConfig = {
  chainId: TEMPO_CHAIN_IDS.PRESTO_MAINNET,
  name: "Presto",
  rpcUrl: "https://rpc.tempo.xyz",
  sponsorUrl: process.env.SPONSOR_URL ?? "https://sponsor.tempo.xyz",
  explorerUrl: "https://explore.tempo.xyz",
  usdcE: "0x20c000000000000000000000b9537d11c60e8b50",
  demoStable: "0x20c0000000000000000000000000000000000000", // pathUSD
  usdt0: "0x20c00000000000000000000014f22ca97301eb73",
};

export const TEMPO_CHAINS: Record<TempoChainId, ChainConfig> = {
  [TEMPO_CHAIN_IDS.PRESTO_MAINNET]: PRESTO,
  [TEMPO_CHAIN_IDS.MODERATO_TESTNET]: MODERATO,
};

/** Default chain for v0 wallet flows — testnet only. */
export function defaultTempoChainId(): TempoChainId {
  // Allow override via env for future mainnet flip; default Moderato today.
  const raw = process.env.PELLET_TEMPO_CHAIN_ID;
  if (raw && Number(raw) === TEMPO_CHAIN_IDS.PRESTO_MAINNET) {
    return TEMPO_CHAIN_IDS.PRESTO_MAINNET;
  }
  return TEMPO_CHAIN_IDS.MODERATO_TESTNET;
}

export function tempoChainConfig(chainId: TempoChainId = defaultTempoChainId()): ChainConfig {
  return TEMPO_CHAINS[chainId];
}

export const TEMPO_EXPLORER_URL = tempoChainConfig().explorerUrl;

// AccountKeychain precompile — same address on every Tempo chain.
export const ACCOUNT_KEYCHAIN_ADDRESS =
  "0xaAAAaaAA00000000000000000000000000000000" as const;

// Settlement event topic (0x92ed5f...) is the OLI-ingest concern; the
// authorize precompile address above is the wallet concern. Kept in
// separate constant per separation of concerns.

// Selectors we'll need for Phase 3.B + 4.
export const SELECTORS = {
  // T3 authorizeKey — T2 (0x54063a55) is REJECTED post-2026-04-21 with
  // LegacyAuthorizeKeySelectorChanged.
  authorizeKey: "0x980a6025",
  revokeKey: "0x5ae7ab32",
  updateSpendingLimit: "0xcbbb4480",
  setAllowedCalls: "0xf5456703",
  getKey: "0xbc298553",
  getRemainingLimit: "0x63b4290d",
  getRemainingLimitWithPeriod: "0xa7f72cab",
  // x402 settlement primitive on TIP-20.
  transferWithMemo: "0x95777d59",
  // Stablecoin DEX (0xdec0…) swap.
  swapExactAmountIn: "0xf8856c0f",
} as const;

export const STABLECOIN_DEX_ADDRESS =
  "0xdec0000000000000000000000000000000000000" as const;

export type PlatformFeeConfig =
  | { enabled: true; bps: number; treasury: `0x${string}` }
  | { enabled: false };

export function platformFeeConfig(): PlatformFeeConfig {
  const bps = parseInt(process.env.PLATFORM_FEE_BPS ?? "0", 10);
  const treasury = process.env.PLATFORM_TREASURY_ADDRESS;
  if (!bps || !treasury || !/^0x[0-9a-fA-F]{40}$/.test(treasury)) {
    return { enabled: false };
  }
  return { enabled: true, bps, treasury: treasury as `0x${string}` };
}

export function computeFee(amountWei: bigint, bps: number): { fee: bigint; remainder: bigint } {
  const fee = (amountWei * BigInt(bps)) / BigInt(10_000);
  return { fee, remainder: amountWei - fee };
}

export const SIG_TYPE = {
  Secp256k1: 0,
  P256: 1,
  WebAuthn: 2,
} as const;
