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
    const r = await db.execute(
      asOf
        ? sql`
            SELECT composite, components, computed_at
            FROM risk_scores_history
            WHERE stable = ${stable} AND computed_at <= ${asOf}
            ORDER BY computed_at DESC
            LIMIT 1
          `
        : sql`
            SELECT composite, components, computed_at
            FROM risk_scores WHERE stable = ${stable} LIMIT 1
          `,
    );
    const rows = ((r as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (r as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
    const row = rows[0];
    if (!row) {
      return NextResponse.json(
        {
          address: stable,
          as_of: asOf?.toISOString() ?? null,
          score: null,
          note: asOf
            ? "No risk score recorded on or before this timestamp. History begins when snapshot tracking was enabled."
            : undefined,
        },
        { status: 404 },
      );
    }
    return withReproducibility(
      NextResponse.json({
        address: stable,
        as_of: asOf?.toISOString() ?? null,
        composite: Number(row.composite),
        components: row.components,
        computed_at: row.computed_at,
      }),
      {
        method: asOf ? "composite-risk-v1-asof" : "composite-risk-v1",
        tables: asOf
          ? ["risk_scores_history", "peg_aggregates", "peg_events", "stablecoins"]
          : ["risk_scores", "peg_aggregates", "peg_events", "stablecoins"],
        freshnessSec: 300,
        asOf,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
