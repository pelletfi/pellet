/**
 * lib/pipeline/tip403-admin.ts
 *
 * TIP-403 policy admin scan — which policies does a given address administer?
 *
 * Approach: read `policyIdCounter()` from the TIP-403 registry to get the
 * upper bound on policy IDs, then bulk-read every `policyData(i)` via
 * multicall and filter for entries where `admin == targetAddress`.
 *
 * This is the single most agent-relevant enrichment for wallet intelligence:
 * policy admins hold the maximum compliance leverage over a stablecoin. An
 * agent checking "who can freeze USDC.e" or "is Circle behind this token"
 * needs this answer, and no other Tempo-native service produces it today.
 *
 * Performance: scales with the number of registered policies (expected
 * O(dozens) in the early Tempo ecosystem). All reads issued in one
 * multicall. If policy count grows past ~200, this should move to a
 * background cron that snapshots (policyId, admin) into a DB table.
 */

import { tempoClient } from "@/lib/rpc";
import { TEMPO_ADDRESSES } from "@/lib/types";

// Minimal TIP-403 read ABI for admin scan. Same shape as the pre-trade
// oracle's TIP403_READ_ABI, deliberately duplicated rather than shared
// to keep these two pipelines independent.
const TIP403_ADMIN_SCAN_ABI = [
  {
    name: "policyIdCounter",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint64" }],
  },
  {
    name: "policyData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "policyId", type: "uint64" }],
    outputs: [
      { name: "policyType", type: "uint8" },
      { name: "admin", type: "address" },
    ],
  },
] as const;

// Policy type enum per spec: 0 = WHITELIST, 1 = BLACKLIST. No compound.
const POLICY_TYPE_LABELS = ["whitelist", "blacklist"] as const;

// Upper bound on policies we'll scan inline. If `policyIdCounter` exceeds
// this we still scan, but we return coverage:"partial" with a note so
// consumers know the result isn't exhaustive. Move to background-cron
// indexing before this number matters in practice.
const INLINE_SCAN_LIMIT = 250;

export interface AdministeredPolicy {
  policy_id: number;
  policy_type: "whitelist" | "blacklist" | "unknown";
  admin: string;
}

export interface PoliciesAdministeredResult {
  policies: AdministeredPolicy[];
  /** Total policy count known to the registry at scan time. */
  total_policy_count: number;
  /** How many of those we actually inspected (may be less than total for huge registries). */
  scanned_policy_count: number;
  coverage: "complete" | "partial" | "unavailable";
  coverage_note: string | null;
}

/**
 * Return every TIP-403 policy where `address` is the admin.
 *
 * Bounded-parallel multicall. Returns coverage:"unavailable" if the
 * registry read fails; coverage:"partial" if the total policy count
 * exceeds INLINE_SCAN_LIMIT (we still scan the first N but are honest
 * about the gap).
 */
export async function getPoliciesAdministered(
  address: `0x${string}`
): Promise<PoliciesAdministeredResult> {
  // ── 1. Read total policy count ─────────────────────────────────────────
  let totalPolicyCount: number;
  try {
    const counter = await tempoClient.readContract({
      address: TEMPO_ADDRESSES.tip403Registry,
      abi: TIP403_ADMIN_SCAN_ABI,
      functionName: "policyIdCounter",
    });
    totalPolicyCount = Number(counter);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      policies: [],
      total_policy_count: 0,
      scanned_policy_count: 0,
      coverage: "unavailable",
      coverage_note: `TIP-403 policyIdCounter() read failed: ${msg.slice(0, 140)}`,
    };
  }

  if (totalPolicyCount === 0) {
    return {
      policies: [],
      total_policy_count: 0,
      scanned_policy_count: 0,
      coverage: "complete",
      coverage_note: null,
    };
  }

  // ── 2. Decide scan range ──────────────────────────────────────────────
  const scanCount = Math.min(totalPolicyCount, INLINE_SCAN_LIMIT);
  const truncated = scanCount < totalPolicyCount;

  // ── 3. Bulk-read all policyData(i) via multicall ──────────────────────
  // Policy IDs start at 0 and go through policyIdCounter - 1 (per spec
  // `policyId = 0 → always false; policyId = 1 → always true; ≥2 → real`).
  // We still scan 0 and 1 to surface any admin assignments on those slots.
  const calls = Array.from({ length: scanCount }, (_, i) => ({
    address: TEMPO_ADDRESSES.tip403Registry,
    abi: TIP403_ADMIN_SCAN_ABI,
    functionName: "policyData" as const,
    args: [BigInt(i)] as const,
  }));

  let results: Array<
    | { status: "success"; result: readonly [number, `0x${string}`] }
    | { status: "failure"; error: Error }
  >;
  try {
    results = (await tempoClient.multicall({
      contracts: calls,
      allowFailure: true,
    })) as typeof results;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      policies: [],
      total_policy_count: totalPolicyCount,
      scanned_policy_count: 0,
      coverage: "unavailable",
      coverage_note: `Multicall of policyData() reads failed: ${msg.slice(0, 140)}`,
    };
  }

  // ── 4. Filter for policies where admin matches ───────────────────────
  const targetLower = address.toLowerCase();
  const matches: AdministeredPolicy[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status !== "success") continue;
    const [policyTypeRaw, admin] = r.result;
    if (admin.toLowerCase() !== targetLower) continue;
    const policyType =
      policyTypeRaw < POLICY_TYPE_LABELS.length
        ? POLICY_TYPE_LABELS[policyTypeRaw]
        : "unknown";
    matches.push({
      policy_id: i,
      policy_type: policyType,
      admin,
    });
  }

  const coverage: PoliciesAdministeredResult["coverage"] = truncated
    ? "partial"
    : "complete";
  const coverage_note = truncated
    ? `Registry has ${totalPolicyCount} policies but this inline scan only inspected the first ${scanCount}. Policies beyond index ${scanCount - 1} were not checked — move to background-cron snapshot before this matters in practice.`
    : null;

  return {
    policies: matches,
    total_policy_count: totalPolicyCount,
    scanned_policy_count: scanCount,
    coverage,
    coverage_note,
  };
}
