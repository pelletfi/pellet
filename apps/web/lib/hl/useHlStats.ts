"use client";

import { useEffect, useState } from "react";
import { zeroAddress } from "viem";

import { getRegistryAddresses } from "./addresses";
import { getHlClient } from "./client";
import { identityRegistryAbi } from "./abi/identity";
import { reputationRegistryAbi } from "./abi/reputation";
import { validationRegistryAbi } from "./abi/validation";
import type { HlChain } from "./types";

export type HlStatValue = {
  // The raw number. `null` while unresolved.
  value: bigint | null;
  // Whether there's a backing source to read from.
  // For block: always true. For registries: true once non-zero address configured.
  available: boolean;
};

export type HlStats = {
  block: HlStatValue;
  agents: HlStatValue;
  attestations: HlStatValue;
  validations: HlStatValue;
};

const BLOCK_POLL_MS = 4_000;
const REGISTRY_POLL_MS = 12_000;

export function useHlStats(chain: HlChain = "mainnet"): HlStats {
  const [stats, setStats] = useState<HlStats>({
    block: { value: null, available: true },
    agents: { value: null, available: false },
    attestations: { value: null, available: false },
    validations: { value: null, available: false },
  });

  useEffect(() => {
    let alive = true;
    const client = getHlClient(chain);
    const addrs = getRegistryAddresses(chain);
    const identityAvail = addrs.identity !== zeroAddress;
    const reputationAvail = addrs.reputation !== zeroAddress;
    const validationAvail = addrs.validation !== zeroAddress;

    // reflect availability on first render
    setStats((prev) => ({
      block: { ...prev.block, available: true },
      agents: { ...prev.agents, available: identityAvail },
      attestations: { ...prev.attestations, available: reputationAvail },
      validations: { ...prev.validations, available: validationAvail },
    }));

    const pollBlock = async () => {
      try {
        const bn = await client.getBlockNumber();
        if (!alive) return;
        setStats((prev) => ({ ...prev, block: { value: bn, available: true } }));
      } catch {
        /* transient RPC error — keep prior value */
      }
    };

    const pollRegistries = async () => {
      try {
        const calls: Promise<bigint>[] = [];
        if (identityAvail) {
          calls.push(
            client.readContract({
              address: addrs.identity,
              abi: identityRegistryAbi,
              functionName: "totalAgents",
            }) as Promise<bigint>,
          );
        } else calls.push(Promise.resolve(0n));

        if (reputationAvail) {
          calls.push(
            (async () => {
              const next = (await client.readContract({
                address: addrs.reputation,
                abi: reputationRegistryAbi,
                functionName: "nextAttestationId",
              })) as bigint;
              return next > 0n ? next - 1n : 0n;
            })(),
          );
        } else calls.push(Promise.resolve(0n));

        if (validationAvail) {
          calls.push(
            (async () => {
              const next = (await client.readContract({
                address: addrs.validation,
                abi: validationRegistryAbi,
                functionName: "nextValidationId",
              })) as bigint;
              return next > 0n ? next - 1n : 0n;
            })(),
          );
        } else calls.push(Promise.resolve(0n));

        const [agents, attestations, validations] = await Promise.all(calls);
        if (!alive) return;
        setStats((prev) => ({
          ...prev,
          agents: { value: identityAvail ? agents : null, available: identityAvail },
          attestations: {
            value: reputationAvail ? attestations : null,
            available: reputationAvail,
          },
          validations: {
            value: validationAvail ? validations : null,
            available: validationAvail,
          },
        }));
      } catch {
        /* transient RPC error — keep prior value */
      }
    };

    void pollBlock();
    void pollRegistries();
    const blockTimer = setInterval(pollBlock, BLOCK_POLL_MS);
    const regTimer = setInterval(pollRegistries, REGISTRY_POLL_MS);

    return () => {
      alive = false;
      clearInterval(blockTimer);
      clearInterval(regTimer);
    };
  }, [chain]);

  return stats;
}
