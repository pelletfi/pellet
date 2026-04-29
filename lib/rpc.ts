import { createPublicClient, http } from "viem";
import { tempo } from "viem/chains";
import { tempoActions } from "viem/tempo";

// Native Tempo RPC handles wide getLogs ranges and single reads without rate
// limits. Use rpc.tempo.xyz (canonical public endpoint, chainId 4217).
//
// Override via TEMPO_RPC_URL env when needed (e.g., custom indexer endpoint).
const RPC_URL = process.env.TEMPO_RPC_URL ?? "https://rpc.tempo.xyz";

// Default client for spot reads (current state, single calls).
export const tempoClient = createPublicClient({
  chain: tempo,
  transport: http(RPC_URL, { timeout: 10_000, retryCount: 2 }),
}).extend(tempoActions());

// Dedicated client for historical getLogs (bulk-range backfill).
// Same endpoint v0; split out so we can swap to a different provider later
// without touching spot-read paths.
export const ingestClient = createPublicClient({
  chain: tempo,
  transport: http(RPC_URL),
}).extend(tempoActions());
