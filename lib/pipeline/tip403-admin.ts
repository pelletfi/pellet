/**
 * lib/pipeline/tip403-admin.ts
 *
 * TIP-403 policy admin scan — which tracked TIP-20 stablecoins does a
 * given address administer the policy of?
 *
 * Implementation note: Tempo's TIP-403 predeploy does NOT expose the
 * `policyData(uint64 policyId)` function that viem/tempo's canonical ABI
 * declares — live calls revert with an "unknown function selector" error.
 * What IS live: `getPolicy(address token)` which returns the full policy
 * record keyed by token. So we iterate through KNOWN_STABLECOINS rather
 * than through a policy ID range.
 *
 * This is actually the more agent-useful framing — agents want to know
 * "which tokens does 0xABC administer the compliance policy for?" not
 * "which policy IDs." The answer is more semantically meaningful when it
 * carries the token symbol + address alongside the policy metadata.
 *
 * Coverage limitation: only tracked stablecoins are scanned. An address
 * that administers an untracked TIP-20 won't show up. Honest coverage
 * flag reflects this.
 */

import { tempoClient } from "@/lib/rpc";
import { TEMPO_ADDRESSES } from "@/lib/types";
import { KNOWN_STABLECOINS } from "@/lib/pipeline/stablecoins";

const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;

// Same ABI we use in stablecoins.ts — `getPolicy(token)` returns the full
// 5-tuple (policyId, policyType, admin, supplyCap, paused) per token.
const TIP403_GET_POLICY_ABI = [
  {
    name: "getPolicy",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "policyId", type: "uint256" },
      { name: "policyType", type: "uint8" },
      { name: "admin", type: "address" },
      { name: "supplyCap", type: "uint256" },
      { name: "paused", type: "bool" },
    ],
  },
] as const;

// Policy type enum per spec: 0 = WHITELIST, 1 = BLACKLIST. No compound.
const POLICY_TYPE_LABELS = ["whitelist", "blacklist"] as const;

export interface AdministeredPolicy {
  token_address: string;
  token_symbol: string;
  token_name: string;
  policy_id: number;
  policy_type: "whitelist" | "blacklist" | "unknown";
  admin: string;
}

export interface PoliciesAdministeredResult {
  policies: AdministeredPolicy[];
  /** How many tracked stablecoins we scanned. */
  stables_scanned: number;
  coverage: "complete" | "partial" | "unavailable";
  coverage_note: string | null;
}

/**
 * Return every tracked TIP-20 stablecoin where `address` is the policy admin.
 *
 * Reads `getPolicy(token)` for each token in KNOWN_STABLECOINS via a single
 * multicall. Filters for admin match and returns token + policy metadata.
 */
export async function getPoliciesAdministered(
  address: `0x${string}`
): Promise<PoliciesAdministeredResult> {
  if (KNOWN_STABLECOINS.length === 0) {
    return {
      policies: [],
      stables_scanned: 0,
      coverage: "complete",
      coverage_note: null,
    };
  }

  // Build one multicall for getPolicy(token) per tracked stablecoin.
  const calls = KNOWN_STABLECOINS.map((s) => ({
    address: TEMPO_ADDRESSES.tip403Registry,
    abi: TIP403_GET_POLICY_ABI,
    functionName: "getPolicy" as const,
    args: [s.address] as const,
  }));

  let results: Array<
    | {
        status: "success";
        result: readonly [bigint, number, `0x${string}`, bigint, boolean];
      }
    | { status: "failure"; error: Error }
  >;
  try {
    results = (await tempoClient.multicall({
      contracts: calls,
      allowFailure: true,
      multicallAddress: MULTICALL3_ADDRESS,
    })) as typeof results;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      policies: [],
      stables_scanned: 0,
      coverage: "unavailable",
      coverage_note: `Multicall of getPolicy() reads failed: ${msg.slice(0, 140)}`,
    };
  }

  const targetLower = address.toLowerCase();
  const matches: AdministeredPolicy[] = [];
  let scanned = 0;
  let failures = 0;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status !== "success") {
      failures++;
      continue;
    }
    scanned++;
    const [pid, ptype, admin] = r.result;
    if (admin.toLowerCase() !== targetLower) continue;
    const policyType =
      ptype < POLICY_TYPE_LABELS.length
        ? POLICY_TYPE_LABELS[ptype]
        : "unknown";
    const stable = KNOWN_STABLECOINS[i];
    matches.push({
      token_address: stable.address,
      token_symbol: stable.symbol,
      token_name: stable.name,
      policy_id: Number(pid),
      policy_type: policyType,
      admin,
    });
  }

  const coverage: PoliciesAdministeredResult["coverage"] =
    failures === 0 ? "complete" : "partial";
  const coverage_note =
    failures > 0
      ? `${failures} of ${KNOWN_STABLECOINS.length} tracked stablecoin policy reads failed. Results reflect the ${scanned} successful reads only.`
      : null;

  return {
    policies: matches,
    stables_scanned: scanned,
    coverage,
    coverage_note,
  };
}
