// Server-side queries for the /hl dashboard. Each function is wrapped in
// `unstable_cache` with a short revalidate window so RSC pages don't hit
// HyperEVM's rate-limited public RPC on every render.

import { unstable_cache } from "next/cache";
import type { Hex } from "viem";

import { getRegistryAddresses } from "./addresses";
import { identityRegistryAbi } from "./abi/identity";
import { reputationRegistryAbi } from "./abi/reputation";
import { validationRegistryAbi } from "./abi/validation";
import { getHlClient } from "./client";
import type { HlChain } from "./types";

/**
 * HyperEVM's public RPC rate-limits aggressively (-32005 "rate limited").
 * Retry once after a short delay before bubbling the error up — most rate-
 * limit hits clear within a second.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = /rate limit|-32005|exceeds defined limit/i.test(msg);
      if (!isRateLimit || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastErr as Error;
}

export interface AgentRow {
  agentId: string;
  controller: Hex;
  metadataURI: string;
  registeredAt: number; // unix seconds
}

export interface AgentDetail {
  agentId: string;
  controller: Hex;
  registeredAt: number;
  metadataURI: string;
}

export interface AttestationRow {
  attestationId: string;
  agentId: string;
  attester: Hex;
  timestamp: number;
  attestationType: Hex;
  score: string; // int256 as string
  metadataURI: string;
}

export interface ValidationRow {
  validationId: string;
  agentId: string;
  validator: Hex;
  timestamp: number;
  claimHash: Hex;
  proofURI: string;
}

export interface RegistryStats {
  totalAgents: number;
  totalAttestations: number;
  totalValidations: number;
  headBlock: string;
}

/**
 * Read every registered agent via direct contract reads. With small registries
 * this is faster + far more reliable than `eth_getLogs` over the full history,
 * since HyperEVM's public RPC throttles parallel log scans aggressively. The
 * `agents(id)` mapping returns the full struct including `registeredAt`, so we
 * don't need event timestamps.
 */
export const listAllAgents = unstable_cache(
  async (chain: HlChain = "mainnet"): Promise<AgentRow[]> => {
    const client = getHlClient(chain);
    const addrs = getRegistryAddresses(chain);

    const nextId = await withRetry(() =>
      client.readContract({
        address: addrs.identity,
        abi: identityRegistryAbi,
        functionName: "nextAgentId",
      }),
    ) as bigint;

    if (nextId <= 1n) return [];

    const total = Number(nextId - 1n);
    const ids = Array.from({ length: total }, (_, i) => BigInt(i + 1));
    // Sequential reads — parallelizing tips us over HyperEVM's rate limit
    // quickly. With small registries the latency is fine.
    const records: Array<{ id: bigint; raw: readonly [Hex, bigint, string] | null }> = [];
    for (const id of ids) {
      try {
        const raw = (await withRetry(() =>
          client.readContract({
            address: addrs.identity,
            abi: identityRegistryAbi,
            functionName: "agents",
            args: [id],
          }),
        )) as readonly [Hex, bigint, string];
        records.push({ id, raw });
      } catch {
        records.push({ id, raw: null });
      }
    }

    const rows: AgentRow[] = [];
    for (const rec of records) {
      if (!rec.raw) continue;
      const [controller, registeredAt, metadataURI] = rec.raw;
      rows.push({
        agentId: rec.id.toString(),
        controller,
        metadataURI,
        registeredAt: Number(registeredAt),
      });
    }
    rows.sort((a, b) => Number(BigInt(b.agentId) - BigInt(a.agentId)));
    return rows;
  },
  ["hl:listAllAgents"],
  { revalidate: 300, tags: ["hl"] },
);

/**
 * Direct read of the `agents` mapping. Returns null only when the controller
 * is the zero address (genuinely unregistered). Transient errors bubble up so
 * we don't cache a 404 just because HyperEVM was rate-limiting.
 */
export const getAgentById = unstable_cache(
  async (chain: HlChain, agentId: string): Promise<AgentDetail | null> => {
    const client = getHlClient(chain);
    const addrs = getRegistryAddresses(chain);
    const id = BigInt(agentId);
    const raw = (await withRetry(() =>
      client.readContract({
        address: addrs.identity,
        abi: identityRegistryAbi,
        functionName: "agents",
        args: [id],
      }),
    )) as readonly [Hex, bigint, string];
    const [controller, registeredAt, metadataURI] = raw;
    if (controller === "0x0000000000000000000000000000000000000000") return null;
    return {
      agentId,
      controller,
      registeredAt: Number(registeredAt),
      metadataURI,
    };
  },
  ["hl:getAgentById"],
  { revalidate: 60, tags: ["hl"] },
);

/** Attestations posted *to* a given agent. Uses contract index helpers. */
export const listAttestationsForAgent = unstable_cache(
  async (chain: HlChain, agentId: string): Promise<AttestationRow[]> => {
    const client = getHlClient(chain);
    const addrs = getRegistryAddresses(chain);
    const id = BigInt(agentId);
    const count = (await withRetry(() =>
      client.readContract({
        address: addrs.reputation,
        abi: reputationRegistryAbi,
        functionName: "attestationCountForAgent",
        args: [id],
      }),
    )) as bigint;

    const rows: AttestationRow[] = [];
    for (let i = 0n; i < count; i++) {
      const attId = (await withRetry(() =>
        client.readContract({
          address: addrs.reputation,
          abi: reputationRegistryAbi,
          functionName: "attestationsByAgent",
          args: [id, i],
        }),
      )) as bigint;
      const att = (await withRetry(() =>
        client.readContract({
          address: addrs.reputation,
          abi: reputationRegistryAbi,
          functionName: "getAttestation",
          args: [attId],
        }),
      )) as {
        agentId: bigint;
        attester: Hex;
        timestamp: bigint;
        attestationType: Hex;
        score: bigint;
        metadataURI: string;
      };
      rows.push({
        attestationId: attId.toString(),
        agentId: att.agentId.toString(),
        attester: att.attester,
        timestamp: Number(att.timestamp),
        attestationType: att.attestationType,
        score: att.score.toString(),
        metadataURI: att.metadataURI,
      });
    }
    rows.sort((a, b) => b.timestamp - a.timestamp);
    return rows;
  },
  ["hl:listAttestationsForAgent"],
  { revalidate: 60, tags: ["hl"] },
);

/** Validations posted *of* a given agent. Uses contract index helpers. */
export const listValidationsForAgent = unstable_cache(
  async (chain: HlChain, agentId: string): Promise<ValidationRow[]> => {
    const client = getHlClient(chain);
    const addrs = getRegistryAddresses(chain);
    const id = BigInt(agentId);
    const count = (await withRetry(() =>
      client.readContract({
        address: addrs.validation,
        abi: validationRegistryAbi,
        functionName: "validationCountForAgent",
        args: [id],
      }),
    )) as bigint;

    const rows: ValidationRow[] = [];
    for (let i = 0n; i < count; i++) {
      const valId = (await withRetry(() =>
        client.readContract({
          address: addrs.validation,
          abi: validationRegistryAbi,
          functionName: "validationsByAgent",
          args: [id, i],
        }),
      )) as bigint;
      const val = (await withRetry(() =>
        client.readContract({
          address: addrs.validation,
          abi: validationRegistryAbi,
          functionName: "getValidation",
          args: [valId],
        }),
      )) as {
        agentId: bigint;
        validator: Hex;
        timestamp: bigint;
        claimHash: Hex;
        proofURI: string;
      };
      rows.push({
        validationId: valId.toString(),
        agentId: val.agentId.toString(),
        validator: val.validator,
        timestamp: Number(val.timestamp),
        claimHash: val.claimHash,
        proofURI: val.proofURI,
      });
    }
    rows.sort((a, b) => b.timestamp - a.timestamp);
    return rows;
  },
  ["hl:listValidationsForAgent"],
  { revalidate: 60, tags: ["hl"] },
);

/** Top-line stats from contract counters. Cached 30s. */
export const getRegistryStats = unstable_cache(
  async (chain: HlChain = "mainnet"): Promise<RegistryStats> => {
    const client = getHlClient(chain);
    const addrs = getRegistryAddresses(chain);
    // Sequential — HyperEVM rate-limits parallel calls.
    const totalAgents = (await withRetry(() =>
      client.readContract({
        address: addrs.identity,
        abi: identityRegistryAbi,
        functionName: "totalAgents",
      }),
    )) as bigint;
    const nextAtt = (await withRetry(() =>
      client.readContract({
        address: addrs.reputation,
        abi: reputationRegistryAbi,
        functionName: "nextAttestationId",
      }),
    )) as bigint;
    const nextVal = (await withRetry(() =>
      client.readContract({
        address: addrs.validation,
        abi: validationRegistryAbi,
        functionName: "nextValidationId",
      }),
    )) as bigint;
    const head = await withRetry(() => client.getBlockNumber());
    return {
      totalAgents: Number(totalAgents),
      totalAttestations: Number(nextAtt > 0n ? nextAtt - 1n : 0n),
      totalValidations: Number(nextVal > 0n ? nextVal - 1n : 0n),
      headBlock: head.toString(),
    };
  },
  ["hl:getRegistryStats"],
  { revalidate: 30, tags: ["hl"] },
);
