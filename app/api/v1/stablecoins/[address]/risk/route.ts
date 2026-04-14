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
    const r = await db.execute(sql`
      SELECT composite, components, computed_at
      FROM risk_scores WHERE stable = ${stable} LIMIT 1
    `);
    const rows = ((r as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (r as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
    const row = rows[0];
    if (!row) return NextResponse.json({ address: stable, score: null }, { status: 404 });
    return NextResponse.json({
      address: stable,
      composite: Number(row.composite),
      components: row.components,
      computed_at: row.computed_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
