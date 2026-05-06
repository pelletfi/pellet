// Read on-chain balances for a Pellet-managed Tempo account. Server-side
// only; uses viem against the chain's RPC.

import { createPublicClient, http, parseAbi, type Address } from "viem";
import { tempoModerato, tempo as tempoMainnet } from "viem/chains";
import { tempoChainConfig } from "./tempo-config";

const TIP20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
]);

// Moderato demo stable (AlphaUSD) — use chain config's demoStable, not a
// hardcoded address. The old 0x…001a was uninitialized on-chain.

export type WalletBalance = {
  symbol: string;
  address: Address;
  raw: bigint;
  display: string; // "12.345" style, 6-decimal formatted
};

export async function readWalletBalances(account: Address): Promise<WalletBalance[]> {
  const chain = tempoChainConfig();
  const viemChain = chain.chainId === tempoMainnet.id ? tempoMainnet : tempoModerato;
  const client = createPublicClient({
    chain: viemChain,
    transport: http(chain.rpcUrl),
  });

  const tokens: Array<{ address: Address; symbol: string }> = [
    { address: chain.usdcE, symbol: "USDC.e" },
    { address: chain.demoStable, symbol: "pathUSD" },
  ];

  const results = await Promise.all(
    tokens.map(async (t) => {
      try {
        const raw = (await client.readContract({
          address: t.address,
          abi: TIP20_ABI,
          functionName: "balanceOf",
          args: [account],
        })) as bigint;
        const display = (Number(raw) / 1_000_000).toFixed(2);
        return { symbol: t.symbol, address: t.address, raw, display };
      } catch {
        // RPC hiccup or token not deployed at this address on this chain
        return { symbol: t.symbol, address: t.address, raw: BigInt(0), display: "0.00" };
      }
    }),
  );
  return results;
}
