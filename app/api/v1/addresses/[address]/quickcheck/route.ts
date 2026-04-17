/**
 * GET /api/v1/addresses/{address}/quickcheck
 *
 * Transaction-time precheck for any Tempo address.  Returns compact boolean
 * flags (is_issuer_of_any / is_minter_of_any / is_pauser_of_any /
 * is_burn_blocked_by_any / is_policy_admin_of_any / has_label) derived from
 * already-populated DB tables — no RPC, no pipeline, no synthesis.  Pure DB
 * reads.  Designed for agents that need to gate a transfer or classify a
 * counterparty in the critical path.
 *
 * Response time target: < 50ms.  The heavy /api/v1/addresses/{addr} endpoint
 * is 1–3s and does the full enumeration; this endpoint is the fast sibling.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

type Row = Record<string, unknown>;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address: rawAddr } = await params;
  if (!ADDRESS_RE.test(rawAddr)) {
    return NextResponse.json(
      { error: { code: "INVALID_ADDRESS", message: "Address must be 0x + 40 hex chars" } },
      { status: 400 },
    );
  }
  const addr = rawAddr.toLowerCase();

  // One round-trip: aggregate every signal we can derive without hitting RPC
  // or running the wallet-intelligence pipeline.  Every count is derived from
  // already-populated tables; the cron layer is what pays the pipeline cost,
  // so this endpoint is effectively free at request time.
  const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM role_holders WHERE holder = ${addr})::int               AS role_count,
      (SELECT COUNT(DISTINCT stable) FROM role_holders WHERE holder = ${addr})::int AS role_stables,
      (SELECT COUNT(*) FROM role_holders
         WHERE holder = ${addr} AND role_name = 'ISSUER_ROLE')::int                  AS issuer_count,
      (SELECT COUNT(*) FROM role_holders
         WHERE holder = ${addr} AND role_name = 'DEFAULT_ADMIN_ROLE')::int           AS admin_count,
      (SELECT COUNT(*) FROM role_holders
         WHERE holder = ${addr} AND role_name = 'PAUSE_ROLE')::int                   AS pauser_count,
      (SELECT COUNT(*) FROM role_holders
         WHERE holder = ${addr} AND role_name = 'UNPAUSE_ROLE')::int                 AS unpauser_count,
      (SELECT COUNT(*) FROM role_holders
         WHERE holder = ${addr} AND role_name = 'BURN_BLOCKED_ROLE')::int            AS burn_blocked_count,
      (SELECT COUNT(*) FROM policies WHERE admin = ${addr})::int                     AS policy_admin_count,
      (SELECT label FROM address_labels WHERE address = ${addr})                     AS label,
      (SELECT category FROM address_labels WHERE address = ${addr})                  AS label_category,
      (SELECT source FROM address_labels WHERE address = ${addr})                    AS label_source
  `);
  const rows = ((result as unknown as { rows?: Row[] }).rows
    ?? (result as unknown as Row[])) as Row[];
  const r = rows[0] ?? {};

  const roleCount = Number(r.role_count ?? 0);
  const policyAdminCount = Number(r.policy_admin_count ?? 0);

  // Plain booleans for the common precheck questions.  "any" means across
  // any tracked stablecoin — use the heavy /api/v1/addresses/{addr} endpoint
  // when you need the per-stable breakdown.
  return NextResponse.json({
    address: addr,
    has_label: r.label !== null && r.label !== undefined,
    label: (r.label as string | null) ?? null,
    label_category: (r.label_category as string | null) ?? null,
    label_source: (r.label_source as string | null) ?? null,
    is_issuer_of_any: Number(r.issuer_count ?? 0) > 0,
    is_minter_of_any: Number(r.issuer_count ?? 0) > 0,
    is_default_admin_of_any: Number(r.admin_count ?? 0) > 0,
    is_pauser_of_any: Number(r.pauser_count ?? 0) > 0,
    is_unpauser_of_any: Number(r.unpauser_count ?? 0) > 0,
    is_burn_blocked_by_any: Number(r.burn_blocked_count ?? 0) > 0,
    is_policy_admin_of_any: policyAdminCount > 0,
    role_count: roleCount,
    role_stables: Number(r.role_stables ?? 0),
    policy_admin_count: policyAdminCount,
    /** True if the address has ANY role or admin attribution — convenient
     * single-flag precheck for "is this wallet privileged in the TIP-20 set?". */
    is_privileged: roleCount > 0 || policyAdminCount > 0,
    coverage: "complete" as const,
    coverage_note: null,
  });
}
