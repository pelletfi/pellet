import { createPublicClient, fallback, http } from "viem";
import { tempo } from "viem/chains";
import { tempoActions } from "viem/tempo";

// Multi-RPC failover. viem's fallback() rotates through transports on RPC error
// and ranks them by latency over time. Order = preferred → backups.
const transports = [
  // Primary: Alchemy if key set (better latency + retention), else native first.
  process.env.ALCHEMY_API_KEY
    ? http(`https://tempo-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`, {
        timeout: 10_000,
        retryCount: 1,
      })
    : null,
  // Native Tempo RPC — always available, no rate limits, slightly slower.
  http("https://rpc.presto.tempo.xyz", { timeout: 10_000, retryCount: 1 }),
].filter(Boolean) as ReturnType<typeof http>[];

export const tempoClient = createPublicClient({
  chain: tempo,
  transport: fallback(transports, { rank: { interval: 60_000 } }),
}).extend(tempoActions());
