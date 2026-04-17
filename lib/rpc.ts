import { createPublicClient, http } from "viem";
import { tempo } from "viem/chains";
import { tempoActions } from "viem/tempo";

// Native Tempo RPC handles everything — wide getLogs ranges, single reads,
// no rate limits to speak of. Alchemy was dropped after we found its free-tier
// cap on eth_getLogs (10 blocks) was incompatible with backfill.
//
// Migrated 2026-04-16 from the pre-launch internal alias `rpc.presto.tempo.xyz`
// to the canonical public endpoint `rpc.tempo.xyz`. Both resolve to chainId 4217
// (mainnet), and presto still works as a soft alias, but the public docs list
// rpc.tempo.xyz as the official URL. Staying on the canonical name avoids any
// future deprecation surprise.
//
// If/when we want true redundancy, add a second tier-1 endpoint here and wrap
// in fallback(). For now keep it simple — fewer moving parts = fewer failures.
export const tempoClient = createPublicClient({
  chain: tempo,
  transport: http("https://rpc.tempo.xyz", { timeout: 10_000, retryCount: 2 }),
}).extend(tempoActions());
