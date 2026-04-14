import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { lookupLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ address: string }>;
}

const TEMPO_ROLES = [
  { name: "DEFAULT_ADMIN_ROLE", powers: "Can grant and revoke other roles" },
  { name: "ISSUER_ROLE", powers: "Can mint and burn tokens" },
  { name: "PAUSE_ROLE", powers: "Can pause transfers (emergency stop)" },
  { name: "UNPAUSE_ROLE", powers: "Can resume transfers after a pause" },
  { name: "BURN_BLOCKED_ROLE", powers: "Can mark addresses as burn-blocked (compliance)" },
];

export async function GET(_req: Request, { params }: Params) {
  const { address } = await params;
  const stable = address.toLowerCase();

  try {
    // role_holders gets populated when (a) Tempo emits RoleMembershipUpdated
    // events for a stable, OR (b) we add a future hasRole probe pipeline keyed
    // off curated suspect addresses. Currently empty for all 12 tracked stables.
    const result = await db.execute(sql`
      SELECT role_name, role_hash, holder, granted_at, granted_tx_hash, holder_type, label
      FROM role_holders
      WHERE stable = ${stable}
      ORDER BY role_name ASC, granted_at ASC
    `);
    const rows = ((result as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (result as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;

    // Resolve labels for every holder address in one query
    const allHolderAddrs = rows.map((r) => String(r.holder));
    const labels = await lookupLabels(allHolderAddrs);

    const byRole = new Map<string, Array<Record<string, unknown>>>();
    for (const r of rows) {
      const name = String(r.role_name ?? "UNKNOWN");
      const holderAddr = String(r.holder).toLowerCase();
      const labelEntry = labels.get(holderAddr);
      if (!byRole.has(name)) byRole.set(name, []);
      byRole.get(name)!.push({
        holder: r.holder,
        holder_label: labelEntry?.label ?? null,
        holder_category: labelEntry?.category ?? null,
        holder_notes: labelEntry?.notes ?? null,
        granted_at: r.granted_at,
        granted_tx_hash: r.granted_tx_hash,
        source: "forensic_derivation",
      });
    }

    return NextResponse.json({
      address: stable,
      coverage: {
        status: byRole.size > 0 ? "partial" : "deriving",
        message:
          byRole.size > 0
            ? `${byRole.size} of ${TEMPO_ROLES.length} TIP-20 roles have confirmed holders.`
            : "No role-bearing on-chain actions have been recorded for this stable yet. The forensic derivation pipeline scans mint/burn/burnBlocked transactions and probes the senders via hasRole(); empty means none of those actions have happened.",
        roles_tracked: TEMPO_ROLES,
        derivation: "Forensic — every mint/burn/burnBlocked tx is inspected; the calling address is verified with hasRole() to confirm current membership.",
      },
      roles: [...byRole.entries()].map(([role_name, holders]) => ({
        role_name,
        role_hash: rows.find((r) => r.role_name === role_name)?.role_hash ?? null,
        holder_count: holders.length,
        holders,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
