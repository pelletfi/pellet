// Read on-chain balances for a Pellet-managed Tempo account. Server-side
// only; uses viem against the chain's RPC. No state, no caching beyond
// what Vercel's edge cache handles per-page.
//
// We read USDC.e specifically because that's what wallets are
// authorized for in v0. pathUSD (the canonical Moderato test stable from
// tempo_fundAddress) lives at a separate address and is exposed
// alongside, since faucet-funded users will have pathUSD before they
// swap to USDC.e.

import { createPublicClient, http, parseAbi, type Address } from "viem";
import { tempoModerato, tempo as tempoMainnet } from "viem/chains";
import { tempoChainConfig } from "./tempo-config";

const TIP20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
]);

// Moderato pathUSD canonical address from tokenlist.tempo.xyz/list/42431.
// (Verified live during phase 3.B research.)
const PATHUSD_MODERATO: Address = "0x20c0000000000000000000004f3edf3b8cb0001a";

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

  // Tokens to read — chain's USDC.e + (testnet only) pathUSD.
  const tokens: Array<{ address: Address; symbol: string }> = [
    { address: chain.usdcE, symbol: "USDC.e" },
  ];
  if (chain.chainId === tempoModerato.id) {
    tokens.push({ address: PATHUSD_MODERATO, symbol: "pathUSD" });
  }

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
