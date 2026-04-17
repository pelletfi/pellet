/**
 * lib/pipeline/erc8004.ts
 *
 * ERC-8004 ("Trustless Agents") registry reads. Tempo deploys both the
 * Identity Registry and Reputation Registry as mainnet predeploys. Both
 * are EIP-1967 upgradeable proxies.
 *
 * Spec: https://eips.ethereum.org/EIPS/eip-8004
 * Predeploys verified 2026-04-16 via eth_getCode.
 *
 * This module provides read-only accessors for agent-centric lookups.
 * Core functions:
 *   - `getAgentStatus(addr)` — is the address an ERC-8004 agent? How many
 *     agent NFTs does it own?
 *
 * Deferred (follow-up work):
 *   - Full identity metadata resolution (tokenURI + registration file)
 *   - Reputation feedback indexing + aggregation
 *   - Cross-reference with TIP-403 admin role history
 */

import { tempoClient } from "@/lib/rpc";
import { TEMPO_ADDRESSES } from "@/lib/types";

// ERC-721 minimal read ABI — the Identity Registry is ERC-721 with URIStorage
// per the ERC-8004 spec, so standard ERC-721 reads apply.
const ERC721_READ_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export interface Erc8004AgentStatus {
  is_erc8004_agent: boolean;
  /** Count of agent NFTs owned by this address (ERC-721 balanceOf). */
  agent_count: number;
  coverage: "complete" | "unavailable";
  coverage_note: string | null;
}

/**
 * Check whether an address is registered as an ERC-8004 agent.
 *
 * Reads `balanceOf(address)` on the Identity Registry. Since agents are
 * minted as ERC-721 NFTs, a balance > 0 means the address owns at least
 * one registered agent identity.
 */
export async function getAgentStatus(
  address: `0x${string}`
): Promise<Erc8004AgentStatus> {
  try {
    const balance = await tempoClient.readContract({
      address: TEMPO_ADDRESSES.erc8004IdentityRegistry,
      abi: ERC721_READ_ABI,
      functionName: "balanceOf",
      args: [address],
    });
    const agent_count = Number(balance);
    return {
      is_erc8004_agent: agent_count > 0,
      agent_count,
      coverage: "complete",
      coverage_note: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      is_erc8004_agent: false,
      agent_count: 0,
      coverage: "unavailable",
      coverage_note: `ERC-8004 Identity Registry read failed: ${msg.slice(0, 140)}`,
    };
  }
}
