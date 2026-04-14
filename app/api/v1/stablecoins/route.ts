import { NextResponse } from "next/server";
import { getAllStablecoins } from "@/lib/pipeline/stablecoins";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const stablecoins = await getAllStablecoins();

    // Join in latest risk score per stable in a single query
    const riskRows = ((await db.execute(sql`
      SELECT stable, composite::float8 AS composite, components, computed_at
      FROM risk_scores
    `)) as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? ([] as Array<Record<string, unknown>>);
    const riskByAddr = new Map<string, { composite: number; components: unknown; computed_at: unknown }>();
    for (const r of riskRows as Array<Record<string, unknown>>) {
      riskByAddr.set(String(r.stable), {
        composite: Number(r.composite),
        components: r.components,
        computed_at: r.computed_at,
      });
    }

    const enriched = stablecoins.map((s) => ({
      ...s,
      risk: riskByAddr.get(s.address.toLowerCase()) ?? null,
    }));

    return NextResponse.json({ stablecoins: enriched });
  } catch (err) {
    console.error("[GET /api/v1/stablecoins]", err);
    return NextResponse.json(
      { error: { code: "ENRICHMENT_FAILED", message: "Failed to fetch stablecoin data" } },
      { status: 502 }
    );
  }
}
