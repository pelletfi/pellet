import { tempoClient } from "@/lib/rpc";
import { TEMPO_ADDRESSES, type ComplianceResult } from "@/lib/types";
import { Abis } from "viem/tempo";

const { tip20Factory } = Abis;

const POLICY_TYPES = ["whitelist", "blacklist", "compound"] as const;

// TIP-403 registry: `getPolicy(token)` returns the full policy record for any
// TIP-20 stablecoin in one call. This is the same ABI the free
// /api/v1/stablecoins endpoint uses (see lib/pipeline/stablecoins.ts).
// It's keyed by token address — NOT by policyId — so it works regardless of
// what `transferPolicyId` the TIP-20 precompile reports via getMetadata().
const TIP403_ABI = [
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

/**
 * Check whether `address` is a TIP-20 token by calling `isTIP20(address)`
 * on the TIP-20 factory contract.
 */
export async function isTip20(address: `0x${string}`): Promise<boolean> {
  try {
    return await tempoClient.readContract({
      address: TEMPO_ADDRESSES.tip20Factory,
      abi: tip20Factory,
      functionName: "isTIP20",
      args: [address],
    });
  } catch {
    return false;
  }
}

/**
 * Aggregate compliance data for a token address.
 *
 * For TIP-20 tokens: reads the full policy record from the TIP-403 registry
 * via `getPolicy(token)` — returns policyId, policyType, admin, supplyCap, paused
 * in a single call. Also reads current totalSupply via the TIP-20 precompile
 * metadata. Computes headroom_pct = (supplyCap - totalSupply) / supplyCap.
 *
 * For plain ERC-20 tokens: reads totalSupply and paused via individual contract
 * calls (paused may revert — caught gracefully). Returns limited data with null
 * policy fields.
 */
export async function getCompliance(
  address: `0x${string}`
): Promise<ComplianceResult> {
  const tip20Token = await isTip20(address);

  if (tip20Token) {
    // Run metadata + policy lookups in parallel. Metadata gives us totalSupply;
    // getPolicy gives us the real policy record including supplyCap and paused.
    const [metaResult, policyResult] = await Promise.allSettled([
      tempoClient.token.getMetadata({ token: address }),
      tempoClient.readContract({
        address: TEMPO_ADDRESSES.tip403Registry,
        abi: TIP403_ABI,
        functionName: "getPolicy",
        args: [address],
      }),
    ]);

    const meta = metaResult.status === "fulfilled" ? metaResult.value : null;
    const totalSupply = meta?.totalSupply ?? 0n;

    let policyId: number | null = null;
    let policyType: ComplianceResult["policy_type"] = null;
    let policyAdmin: string | null = null;
    // Prefer registry's supplyCap and paused — it's the compliance source of truth.
    // Fall back to metadata values if the registry call fails.
    let supplyCap: bigint | null = meta?.supplyCap ?? null;
    let paused: boolean = meta?.paused ?? false;

    if (policyResult.status === "fulfilled" && policyResult.value) {
      const [pid, ptype, admin, cap, regPaused] = policyResult.value as [
        bigint,
        number,
        `0x${string}`,
        bigint,
        boolean,
      ];
      policyId = Number(pid);
      policyType = (POLICY_TYPES[ptype] ?? null) as ComplianceResult["policy_type"];
      policyAdmin = admin;
      if (cap > 0n) supplyCap = cap;
      paused = regPaused;
    }

    // headroom_pct: how much mint capacity remains
    let headroom_pct: number | null = null;
    if (supplyCap !== null && supplyCap > 0n) {
      const remaining = supplyCap - totalSupply;
      headroom_pct = Number((remaining * 10000n) / supplyCap) / 100;
      if (headroom_pct < 0) headroom_pct = 0;
    }

    return {
      token_type: "tip20",
      policy_id: policyId,
      policy_type: policyType,
      policy_admin: policyAdmin,
      paused,
      supply_cap: supplyCap !== null ? supplyCap.toString() : null,
      current_supply: totalSupply.toString(),
      headroom_pct,
      // Role enumeration is not supported on-chain without events; return empty arrays.
      // The forensic-derivation pipeline (/api/v1/stablecoins/{address}/roles) fills
      // this for tracked stables via event scanning + hasRole probes.
      roles: { issuer: [], pause: [], burn_blocked: [] },
    };
  }

  // ERC-20 fallback — read totalSupply and attempt paused()
  const erc20Abi = [
    {
      name: "totalSupply",
      type: "function",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "uint256" }],
    },
    {
      name: "paused",
      type: "function",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "bool" }],
    },
  ] as const;

  const totalSupplyResult = await tempoClient
    .readContract({
      address,
      abi: erc20Abi,
      functionName: "totalSupply",
    })
    .catch(() => 0n);

  const pausedResult = await tempoClient
    .readContract({
      address,
      abi: erc20Abi,
      functionName: "paused",
    })
    .catch(() => false);

  return {
    token_type: "erc20",
    policy_id: null,
    policy_type: null,
    policy_admin: null,
    paused: pausedResult,
    supply_cap: null,
    current_supply: totalSupplyResult.toString(),
    headroom_pct: null,
    roles: { issuer: [], pause: [], burn_blocked: [] },
  };
}
