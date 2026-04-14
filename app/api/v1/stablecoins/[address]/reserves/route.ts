import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { withReproducibility } from "@/lib/reproducibility";
import { parseAsOfFromRequest, InvalidAsOfError } from "@/lib/as-of";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ address: string }>;
}

export async function GET(req: Request, { params }: Params) {
  const { address } = await params;
  const stable = address.toLowerCase();

  let asOf: Date | null;
  try {
    asOf = parseAsOfFromRequest(req);
  } catch (e) {
    if (e instanceof InvalidAsOfError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  try {
    // For time-travel, pick the most recent row per reserve_type at or before asOf.
    const r = await db.execute(
      asOf
        ? sql`
            SELECT DISTINCT ON (reserve_type)
                   reserve_type, backing_usd, attestation_source, attested_at, verified_by, notes
            FROM reserves_history
            WHERE stable = ${stable} AND attested_at <= ${asOf}
            ORDER BY reserve_type, attested_at DESC
          `
        : sql`
            SELECT reserve_type, backing_usd, attestation_source, attested_at, verified_by, notes, updated_at
            FROM reserves WHERE stable = ${stable}
            ORDER BY reserve_type
          `,
    );
    const rows = ((r as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (r as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
    const total = rows.reduce((sum, row) => sum + (row.backing_usd != null ? Number(row.backing_usd) : 0), 0);
    return withReproducibility(
      NextResponse.json({
        address: stable,
        as_of: asOf?.toISOString() ?? null,
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
        method: asOf ? "reserves-tempo-side-v1-asof" : "reserves-tempo-side-v1",
        rpcCall: "totalSupply(stable) × quoteSwap(price)",
        tables: asOf ? ["reserves_history", "stablecoins", "peg_samples"] : ["reserves", "stablecoins", "peg_samples"],
        freshnessSec: 3600,
        asOf,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
