import { tempoClient } from "@/lib/rpc";
import { TEMPO_ADDRESSES, type ComplianceResult } from "@/lib/types";
import { Abis } from "viem/tempo";

const { tip20Factory, tip403Registry } = Abis;

const POLICY_TYPES = ["whitelist", "blacklist", "compound"] as const;

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
 * Fetch policy metadata from the TIP-403 registry for `policyId`.
 * Returns `{ policyType, admin }` where policyType is 0=whitelist,
 * 1=blacklist, 2=compound.
 */
export async function getPolicyData(
  policyId: bigint
): Promise<{ policyType: number; admin: string } | null> {
  try {
    const [policyType, admin] = await tempoClient.readContract({
      address: TEMPO_ADDRESSES.tip403Registry,
      abi: tip403Registry,
      functionName: "policyData",
      args: [policyId],
    });
    return { policyType, admin };
  } catch {
    return null;
  }
}

/**
 * Aggregate compliance data for a token address.
 *
 * For TIP-20 tokens: reads full metadata via `tempoClient.token.getMetadata()`
 * (name, symbol, currency, decimals, totalSupply, paused, supplyCap,
 * quoteToken, transferPolicyId), then resolves policy type + admin from the
 * TIP-403 registry. Computes headroom_pct = (supplyCap - totalSupply) / supplyCap.
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
    const meta = await tempoClient.token.getMetadata({ token: address });

    const totalSupply = meta.totalSupply;
    const supplyCap = meta.supplyCap ?? null;
    const paused = meta.paused ?? false;
    const transferPolicyId = meta.transferPolicyId ?? null;

    // Resolve policy if token has a non-trivial policy (>1)
    let policyId: number | null = null;
    let policyType: ComplianceResult["policy_type"] = null;
    let policyAdmin: string | null = null;

    if (transferPolicyId !== null && transferPolicyId > 1n) {
      policyId = Number(transferPolicyId);
      const policy = await getPolicyData(transferPolicyId);
      if (policy) {
        policyType = (POLICY_TYPES[policy.policyType] ?? null) as ComplianceResult["policy_type"];
        policyAdmin = policy.admin;
      }
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
