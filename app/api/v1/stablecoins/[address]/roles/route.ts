import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { tempoClient } from "@/lib/rpc";
import { TEMPO_ADDRESSES } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ address: string }>;
}

// Same getPolicy signature used by the working stablecoins pipeline.
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

const POLICY_TYPE_LABELS: Record<number, string> = {
  0: "whitelist",
  1: "blacklist",
  2: "compound",
};

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

export async function GET(_req: Request, { params }: Params) {
  const { address } = await params;
  const stable = address.toLowerCase();

  try {
    // 1. Read role_holders from event-replayed table (currently empty for
    //    Tempo-native stables; will populate when role enumeration is unblocked)
    const result = await db.execute(sql`
      SELECT role_name, role_hash, holder, granted_at, granted_tx_hash, holder_type, label
      FROM role_holders
      WHERE stable = ${stable}
      ORDER BY role_name ASC, granted_at ASC
    `);
    const rows = ((result as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (result as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;

    const byRole = new Map<string, Array<Record<string, unknown>>>();
    for (const r of rows) {
      const name = String(r.role_name ?? "UNKNOWN");
      if (!byRole.has(name)) byRole.set(name, []);
      byRole.get(name)!.push({
        holder: r.holder,
        granted_at: r.granted_at,
        granted_tx_hash: r.granted_tx_hash,
        holder_type: r.holder_type,
        label: r.label,
        source: "tempo_event_replay",
      });
    }

    // 2. Augment with TIP-403 policy admin via direct RPC.
    //    This works for any stable that has a non-default policy attached
    //    (transferPolicyId > 1). For pathUSD and others without one, returns null.
    let policyAdmin: string | null = null;
    try {
      const policy = await tempoClient.readContract({
        address: TEMPO_ADDRESSES.tip403Registry,
        abi: TIP403_GET_POLICY_ABI,
        functionName: "getPolicy",
        args: [stable as `0x${string}`],
      });
      const [, ptype, admin] = policy as readonly [bigint, number, `0x${string}`, bigint, boolean];
      if (admin && admin.toLowerCase() !== ZERO_ADDR) {
        policyAdmin = admin.toLowerCase();
        const policyTypeLabel = POLICY_TYPE_LABELS[Number(ptype)] ?? "policy";
        byRole.set("POLICY_ADMIN", [
          {
            holder: policyAdmin,
            granted_at: null,
            granted_tx_hash: null,
            holder_type: null,
            label: `TIP-403 ${policyTypeLabel} admin`,
            source: "tip403_registry",
          },
        ]);
      }
    } catch {
      // No policy attached, or RPC failed — leave POLICY_ADMIN out
    }

    // Coverage metadata — be transparent about what data is available.
    const coverage = {
      available: [
        ...(policyAdmin ? ["POLICY_ADMIN"] : []),
        ...[...byRole.keys()].filter((k) => k !== "POLICY_ADMIN"),
      ],
      pending: [
        "DEFAULT_ADMIN_ROLE",
        "ISSUER_ROLE",
        "PAUSE_ROLE",
        "UNPAUSE_ROLE",
        "BURN_BLOCKED_ROLE",
      ].filter((r) => !byRole.has(r)),
      pending_reason:
        "Tempo's TIP-20 RBAC manages role membership at the precompile level without emitting RoleMembershipUpdated events for these stables. Direct enumeration is not exposed; we can only verify role membership for known addresses via hasRole probes.",
    };

    return NextResponse.json({
      address: stable,
      coverage,
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
