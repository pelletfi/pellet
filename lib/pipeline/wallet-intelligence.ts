/**
 * lib/pipeline/wallet-intelligence.ts
 *
 * Single-endpoint wallet intelligence for any Tempo address. Combines:
 *
 *   - `address_labels` lookup (existing)
 *   - ERC-8004 agent status (new — reads 0x8004A169… identity registry)
 *   - Role holdings across tracked TIP-20 stablecoins (DB query)
 *   - Derived summaries: is_issuer_of, is_minter_of, is_pauser_of, is_burn_blocked_by
 *
 * Coverage discipline (OLI):
 *   - Every section has its own coverage flag.
 *   - Null fields are never inferred as "absent"; coverage:unavailable always
 *     accompanies a null to signal a measurement gap vs a real zero.
 *
 * Deferred (follow-up iterations):
 *   - TIP-403 policy admin scan (which policyId is this address admin of)
 *   - MPP tx activity summary (requires memo-hash indexing per address)
 *   - First/last seen block (expensive historical scan)
 *   - ERC-8004 reputation feedback aggregation (requires agent tokenId mapping)
 *   - ERC-8004 identity metadata resolution (tokenURI + registration file)
 */

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { lookupLabel, type AddressLabel } from "@/lib/labels";
import { getAgentStatus, type Erc8004AgentStatus } from "@/lib/pipeline/erc8004";
import { isAddress } from "viem";

export interface RoleEntry {
  stable: string;
  role_name: string;
  granted_at: string;
  granted_tx_hash: string;
}

export interface WalletIntelligence {
  address: string;
  /** Curated or forensic label, if known. */
  label: AddressLabel | null;
  /** ERC-8004 agent status (is this an agent? how many agent NFTs?). */
  agent: Erc8004AgentStatus;
  /** Every role this address holds across tracked stablecoins. */
  roles: RoleEntry[];
  /** Derived summaries — tokens where this address holds each role. */
  is_issuer_of: string[];
  is_minter_of: string[];
  is_pauser_of: string[];
  is_burn_blocked_by: string[];
  /** Aggregate stats for quick summary. */
  stats: {
    role_count: number;
    stables_involved: number;
    erc8004_agent_count: number;
  };
  /** Measurement gaps the agent should know about. */
  deferred: string[];
  /** Top-level coverage flag. */
  coverage: "complete" | "partial";
  coverage_note: string | null;
}

/**
 * Build a wallet intelligence record for a single address.
 *
 * Read-only. Safe to call repeatedly; each call is ~2 DB queries + 1 RPC.
 */
export async function getWalletIntelligence(
  rawAddress: string
): Promise<WalletIntelligence> {
  if (!isAddress(rawAddress)) {
    return invalidInput(rawAddress);
  }

  const address = rawAddress.toLowerCase() as `0x${string}`;

  // Run all reads in parallel — label, agent status, and role holdings are
  // independent and bounded.
  const [labelResult, agentResult, rolesResult] = await Promise.allSettled([
    lookupLabel(address),
    getAgentStatus(address),
    fetchRoles(address),
  ]);

  const label = labelResult.status === "fulfilled" ? labelResult.value : null;
  const agent =
    agentResult.status === "fulfilled"
      ? agentResult.value
      : {
          is_erc8004_agent: false,
          agent_count: 0,
          coverage: "unavailable" as const,
          coverage_note: "ERC-8004 lookup failed upstream",
        };
  const roles = rolesResult.status === "fulfilled" ? rolesResult.value : [];

  // Derive per-role summaries. Role names come from the forensic pipeline as
  // either canonical string constants (e.g., "ISSUER_ROLE") or raw hash if
  // decoding failed — we match on the canonical names.
  const is_issuer_of: string[] = [];
  const is_minter_of: string[] = [];
  const is_pauser_of: string[] = [];
  const is_burn_blocked_by: string[] = [];
  const seen = { issuer: new Set<string>(), minter: new Set<string>(), pauser: new Set<string>(), burn: new Set<string>() };
  for (const r of roles) {
    const nm = r.role_name.toUpperCase();
    if (nm.includes("ISSUER") && !seen.issuer.has(r.stable)) {
      seen.issuer.add(r.stable);
      is_issuer_of.push(r.stable);
    }
    if (nm.includes("MINTER") && !seen.minter.has(r.stable)) {
      seen.minter.add(r.stable);
      is_minter_of.push(r.stable);
    }
    if (nm.includes("PAUSE") && !seen.pauser.has(r.stable)) {
      seen.pauser.add(r.stable);
      is_pauser_of.push(r.stable);
    }
    if (nm.includes("BURN_BLOCKED") && !seen.burn.has(r.stable)) {
      seen.burn.add(r.stable);
      is_burn_blocked_by.push(r.stable);
    }
  }

  const stablesInvolved = new Set(roles.map((r) => r.stable));

  const deferred = [
    "TIP-403 policy admin scan (which policies this address administers)",
    "MPP transaction activity summary (memo-hash indexing per address)",
    "First/last seen block (historical scan)",
    "ERC-8004 reputation feedback aggregation (requires agent-tokenId mapping)",
    "ERC-8004 identity metadata (tokenURI + registration file resolution)",
  ];

  const coverage: WalletIntelligence["coverage"] =
    labelResult.status === "fulfilled" &&
    agentResult.status === "fulfilled" &&
    rolesResult.status === "fulfilled"
      ? "complete"
      : "partial";

  const coverage_note =
    coverage === "partial"
      ? "One or more data sources (label / ERC-8004 / role DB) failed to resolve. Non-null fields are authoritative; absent data is a measurement gap, not a confirmed absence."
      : null;

  return {
    address,
    label,
    agent,
    roles,
    is_issuer_of,
    is_minter_of,
    is_pauser_of,
    is_burn_blocked_by,
    stats: {
      role_count: roles.length,
      stables_involved: stablesInvolved.size,
      erc8004_agent_count: agent.agent_count,
    },
    deferred,
    coverage,
    coverage_note,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function fetchRoles(address: `0x${string}`): Promise<RoleEntry[]> {
  const result = await db.execute(sql`
    SELECT stable, role_name, granted_at, granted_tx_hash
    FROM role_holders
    WHERE holder = ${address}
    ORDER BY granted_at DESC
  `);
  const rows = ((result as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (result as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    stable: String(r.stable),
    role_name: String(r.role_name ?? "UNKNOWN"),
    granted_at: r.granted_at instanceof Date
      ? r.granted_at.toISOString()
      : String(r.granted_at),
    granted_tx_hash: String(r.granted_tx_hash),
  }));
}

function invalidInput(rawAddress: string): WalletIntelligence {
  return {
    address: rawAddress,
    label: null,
    agent: {
      is_erc8004_agent: false,
      agent_count: 0,
      coverage: "unavailable",
      coverage_note: "Input address is not a valid 0x-prefixed 42-char hex string",
    },
    roles: [],
    is_issuer_of: [],
    is_minter_of: [],
    is_pauser_of: [],
    is_burn_blocked_by: [],
    stats: { role_count: 0, stables_involved: 0, erc8004_agent_count: 0 },
    deferred: [],
    coverage: "partial",
    coverage_note: "Input address is not a valid 0x-prefixed 42-char hex string",
  };
}
