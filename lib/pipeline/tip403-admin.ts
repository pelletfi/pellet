/**
 * lib/pipeline/tip403-admin.ts
 *
 * TIP-403 policy admin lookup — returns every policy on the TIP-403 registry
 * where the given address is the current admin.
 *
 * Backstory: Tempo's live TIP-403 predeploy at 0x403c… doesn't expose the
 * canonical read functions (`policyData` / `getPolicy` both revert with
 * "unknown function selector"), so we can't answer "who admins policy X"
 * with a direct call. Instead, the `tip403-admin-index` cron replays the
 * state-change events emitted by the registry (PolicyCreated + admin
 * updates) into the `policies` table; this module is now a thin DB reader
 * on top of that snapshot.
 *
 * Token-to-policy attribution — which TIP-20 contract on Tempo is gated by
 * a given policyId — is NOT part of this pipeline because the registry
 * doesn't emit an event linking them.  `token_address/symbol/name` are
 * therefore always null in the returned rows; the admin mapping is honest
 * and complete, the token mapping is an open follow-up (indexing the
 * TIP-20-side policy-set events).
 *
 * OLI discipline: admin matches are reported with coverage "complete" when
 * they exist; token fields stay null rather than being inferred from the
 * tracked-stablecoin set.
 */

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export interface AdministeredPolicy {
  /** TIP-20 contract this policy gates. null = token-to-policy mapping not
   * yet indexed; agents must not infer token identity from this row. */
  token_address: string | null;
  token_symbol: string | null;
  token_name: string | null;
  policy_id: number;
  policy_type: "whitelist" | "blacklist" | "compound" | "unknown";
  admin: string;
}

export interface PoliciesAdministeredResult {
  policies: AdministeredPolicy[];
  /** Number of policies currently indexed in the registry snapshot. Optional
   * so existing fallback code paths that don't populate it still type-check. */
  policies_scanned?: number;
  /** Retained for SDK/API back-compat; equals policies_scanned when set. */
  stables_scanned: number;
  coverage: "complete" | "partial" | "unavailable";
  coverage_note: string | null;
}

type PolicyRow = {
  policy_id: number;
  policy_type: string | null;
  admin: string | null;
  updated_at?: string | Date;
};

function normalizePolicyType(
  raw: string | null,
): AdministeredPolicy["policy_type"] {
  if (raw === "whitelist" || raw === "blacklist" || raw === "compound") {
    return raw;
  }
  return "unknown";
}

/** Look up the policies where `address` is currently the admin, sourced
 * from the `policies` table (populated by the `tip403-admin-index` cron). */
export async function getPoliciesAdministered(
  address: `0x${string}`,
): Promise<PoliciesAdministeredResult> {
  const addr = address.toLowerCase();

  // Snapshot freshness — if the policies table hasn't been populated yet we
  // should be explicit about it rather than silently returning zero matches.
  const totalResult = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM policies
  `);
  const totalRows = ((totalResult as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (totalResult as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
  const totalIndexed = Number(totalRows[0]?.n ?? 0);

  if (totalIndexed === 0) {
    return {
      policies: [],
      policies_scanned: 0,
      stables_scanned: 0,
      coverage: "unavailable",
      coverage_note:
        "TIP-403 policy index is empty — the `tip403-admin-index` cron has not populated the policies table yet (runs every 10 min). Re-check shortly; a cold snapshot is not an authoritative zero.",
    };
  }

  const result = await db.execute(sql`
    SELECT policy_id, policy_type, admin, updated_at
    FROM policies
    WHERE admin = ${addr}
    ORDER BY policy_id ASC
  `);
  const rows = ((result as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (result as unknown as Record<string, unknown>[])) as unknown as PolicyRow[];

  const policies: AdministeredPolicy[] = rows.map((r) => ({
    token_address: null,
    token_symbol: null,
    token_name: null,
    policy_id: Number(r.policy_id),
    policy_type: normalizePolicyType(r.policy_type),
    admin: r.admin ?? addr,
  }));

  return {
    policies,
    policies_scanned: totalIndexed,
    stables_scanned: totalIndexed,
    coverage: "partial",
    coverage_note:
      "Admin mapping is derived from indexed PolicyCreated + PolicyAdminUpdated events and is authoritative. Token-to-policy attribution (which TIP-20 contract each policyId gates) is not yet indexed — token_address/symbol/name are null by design, never inferred.",
  };
}
