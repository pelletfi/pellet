import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { withReproducibility } from "@/lib/reproducibility";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ address: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  const { address } = await params;
  const stable = address.toLowerCase();
  try {
    const r = await db.execute(sql`
      SELECT reserve_type, backing_usd, attestation_source, attested_at, verified_by, notes, updated_at
      FROM reserves WHERE stable = ${stable}
      ORDER BY reserve_type
    `);
    const rows = ((r as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (r as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
    const total = rows.reduce((sum, row) => sum + (row.backing_usd != null ? Number(row.backing_usd) : 0), 0);
    return withReproducibility(
      NextResponse.json({
        address: stable,
        total_backing_usd: total || null,
        reserves: rows.map((row) => ({
          reserve_type: row.reserve_type,
          backing_usd: row.backing_usd != null ? Number(row.backing_usd) : null,
          attestation_source: row.attestation_source,
          attested_at: row.attested_at,
          verified_by: row.verified_by,
          notes: row.notes,
        })),
      }),
      {
        method: "reserves-tempo-side-v1",
        rpcCall: "totalSupply(stable) × quoteSwap(price)",
        tables: ["reserves", "stablecoins", "peg_samples"],
        freshnessSec: 3600,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
