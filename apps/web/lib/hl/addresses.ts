import type { HlChain, RegistryAddresses } from "./types";

// Deployed registry addresses per chain.
// Mainnet: deployed 2026-04-23 at block 33290371 on HyperEVM (chain 999).
//   see packages/hl-contracts/deployments/hyperevm-mainnet.json
export const HL_REGISTRY_ADDRESSES: Record<HlChain, RegistryAddresses> = {
  testnet: {
    identity: "0x0000000000000000000000000000000000000000",
    reputation: "0x0000000000000000000000000000000000000000",
    validation: "0x0000000000000000000000000000000000000000",
  },
  mainnet: {
    identity: "0x2bfcb081c8c5F98261efcdEC3971D0b1bc7ad943",
    reputation: "0x8cA1f4E2335271f12E5E14Cd8378B558fd14114b",
    validation: "0x7c44Dc7Fb45D723455DB1b69EE08Bd718998e5B4",
  },
};

// Public block explorer (Blockscout) per chain. HyperScan is the canonical
// HyperEVM explorer at https://www.hyperscan.com. Testnet explorer URL is
// left blank until we verify there.
export const HL_EXPLORER: Record<HlChain, string> = {
  testnet: "",
  mainnet: "https://www.hyperscan.com",
};

export function getRegistryAddresses(chain: HlChain = "testnet"): RegistryAddresses {
  return HL_REGISTRY_ADDRESSES[chain];
}

/** Build an explorer URL for a given on-chain address. */
export function explorerAddressUrl(addr: string, chain: HlChain = "mainnet"): string {
  const base = HL_EXPLORER[chain];
  if (!base) return "";
  return `${base}/address/${addr}`;
}
