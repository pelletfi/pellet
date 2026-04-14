import { createPublicClient, http } from "viem";
import { tempo } from "viem/chains";
import { tempoActions } from "viem/tempo";

// Native Tempo RPC handles everything — wide getLogs ranges, single reads,
// no rate limits to speak of. Alchemy was dropped after we found its free-tier
// cap on eth_getLogs (10 blocks) was incompatible with backfill.
//
// If/when we want true redundancy, add a second tier-1 endpoint here and wrap
// in fallback(). For now keep it simple — fewer moving parts = fewer failures.
export const tempoClient = createPublicClient({
  chain: tempo,
  transport: http("https://rpc.presto.tempo.xyz", { timeout: 10_000, retryCount: 2 }),
}).extend(tempoActions());
