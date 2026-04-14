import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ address: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  const { address } = await params;
  const stable = address.toLowerCase();

  try {
    const result = await db.execute(sql`
      SELECT role_name, role_hash, holder, granted_at, granted_tx_hash, holder_type, label
      FROM role_holders
      WHERE stable = ${stable}
      ORDER BY role_name ASC, granted_at ASC
    `);
    const rows = ((result as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (result as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;

    // Group by role
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
      });
    }

    return NextResponse.json({
      address: stable,
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
