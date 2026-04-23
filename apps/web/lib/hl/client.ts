import { createPublicClient, http, type PublicClient } from "viem";
import type { HlChain } from "./types";

const HL_RPC: Record<HlChain, string> = {
  testnet: "https://rpc.hyperliquid-testnet.xyz/evm",
  mainnet: "https://rpc.hyperliquid.xyz/evm",
};

const HL_CHAIN_ID: Record<HlChain, number> = {
  testnet: 998,
  mainnet: 999, // Verify from HL docs at time of mainnet deploy
};

const cachedClients: Partial<Record<HlChain, PublicClient>> = {};

export function getHlClient(chain: HlChain = "testnet"): PublicClient {
  if (!cachedClients[chain]) {
    cachedClients[chain] = createPublicClient({
      chain: {
        id: HL_CHAIN_ID[chain],
        name: `Hyperliquid ${chain === "testnet" ? "Testnet" : "Mainnet"}`,
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: {
          default: { http: [HL_RPC[chain]] },
        },
      },
      transport: http(HL_RPC[chain]),
    });
  }
  return cachedClients[chain]!;
}
