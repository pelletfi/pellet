/**
 * lib/pipeline/tip403-admin.ts
 *
 * TIP-403 policy admin scan — intended to return every tracked stablecoin
 * where a given address is the policy admin.
 *
 * ⚠️ DISCOVERED 2026-04-17 ~00:30 UTC: Tempo's live TIP-403 predeploy does
 * NOT implement the read functions needed for this scan. Both:
 *
 *   policyData(uint64 policyId)     → returns (uint8, address)
 *   getPolicy(address token)        → returns (uint256, uint8, address, uint256, bool)
 *
 * revert with the custom error `0xaa4bc69a` ("unknown function selector")
 * on every call. These are declared in the canonical viem/tempo ABI and in
 * earlier Pellet code, but the deployed proxy at 0x403c… doesn't back them.
 *
 * Only read functions confirmed working today:
 *   - policyIdCounter()                     → uint64
 *   - isAuthorized(uint64 policyId, address user) → bool  (our pre-trade oracle uses this)
 *
 * So we can answer "is X authorized under policy Y" but NOT enumerate which
 * policies exist or who their admins are, via read functions alone.
 *
 * Workaround path (deferred to a future iteration): index the state-change
 * events emitted by TIP-403 and reconstruct the (policyId → admin) map
 * off-chain:
 *
 *   PolicyCreated(uint64 indexed policyId, address indexed updater, PolicyType policyType)
 *   PolicyAdminUpdated(uint64 indexed policyId, address indexed updater, address indexed admin)
 *   WhitelistUpdated / BlacklistUpdated also correlate an admin to a policy.
 *
 * That's a full indexer job — event subscription + DB snapshot + query layer.
 * Bigger scope than a one-RPC multicall so it belongs in a follow-up build.
 * For now this module returns coverage:"unavailable" with an honest note so
 * wallet-intel consumers know where the gap is.
 *
 * OLI discipline: do not invent coverage we can't deliver. null/unavailable
 * is always clearer than a silent "zero admin matches" that's actually
 * "we couldn't check."
 */

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
  /** How many tracked stablecoins we scanned. Zero until the event-indexer workaround ships. */
  stables_scanned: number;
  coverage: "complete" | "partial" | "unavailable";
  coverage_note: string | null;
}

/**
 * Currently returns coverage:"unavailable" for every address. See module
 * header comment for why — Tempo's TIP-403 read surface doesn't expose the
 * needed functions. Ship the honest answer now; close the gap via the
 * event-indexer workaround in a follow-up iteration.
 */
export async function getPoliciesAdministered(
  _address: `0x${string}`
): Promise<PoliciesAdministeredResult> {
  return {
    policies: [],
    stables_scanned: 0,
    coverage: "unavailable",
    coverage_note:
      "TIP-403 policy admin lookup is not yet available. The live registry at 0x403c… does not implement the policyData / getPolicy read functions that viem/tempo's canonical ABI declares — calls revert with unknown-function selector. Next iteration will reconstruct (policyId → admin) off-chain by indexing PolicyCreated + PolicyAdminUpdated events.",
  };
}
