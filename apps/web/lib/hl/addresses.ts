import type { HlChain, RegistryAddresses } from "./types";

// Deployed registry addresses per chain.
// Updated when Task 7b lands real testnet addresses (see packages/hl-contracts/deployments/).
// Mainnet addresses land after audit (Phase 2+).
export const HL_REGISTRY_ADDRESSES: Record<HlChain, RegistryAddresses> = {
  testnet: {
    identity: "0x0000000000000000000000000000000000000000",
    reputation: "0x0000000000000000000000000000000000000000",
    validation: "0x0000000000000000000000000000000000000000",
  },
  mainnet: {
    identity: "0x0000000000000000000000000000000000000000",
    reputation: "0x0000000000000000000000000000000000000000",
    validation: "0x0000000000000000000000000000000000000000",
  },
};

export function getRegistryAddresses(chain: HlChain = "testnet"): RegistryAddresses {
  return HL_REGISTRY_ADDRESSES[chain];
}
