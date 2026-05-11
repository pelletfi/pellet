// On-chain constants for the public /pltn buy widget.
// Verified 2026-05-09 against rpc.mainnet.tempo.xyz.

export const PLTN = "0x20c00000000000000000000079FFC698EdcAa46a" as const;
export const PATH_USD = "0x20c0000000000000000000000000000000000000" as const;
export const V2_FACTORY = "0xf9ec577a4e45b5278bb7cf60fcbc20c3acaef68f" as const;
export const V2_ROUTER = "0x0fbac3c46f6f83b44c7fb4ea986d7309c701d73e" as const;
export const PAIR = "0xa7dd0D220cA19687331d0A196F47b3E48c83eaff" as const;
export const DEPLOYER_EOA = "0xEfAe266a1D0611236c4220Ad86F4ff953d84080F" as const;
export const GENESIS_TX =
  "0xc5b0b7d84f242830fbab2cb65417a77b03ff5d32efbc9ac192c47fbf507be6b9" as const;
export const GENESIS_BLOCK = 19039113n;

export const TEMPO_CHAIN_ID = 4217;
export const RPC_URL = "https://rpc.mainnet.tempo.xyz";
export const EXPLORER_URL = "https://explore.mainnet.tempo.xyz";

export const PLTN_DECIMALS = 6;
export const PATH_USD_DECIMALS = 6;
export const TOTAL_SUPPLY = 100_000_000n * 10n ** 6n;
export const LP_PLTN = 5_000_000n * 10n ** 6n;
export const LP_QUOTE = 200n * 10n ** 6n;
