import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  for (const t of ["events", "peg_samples", "ingestion_cursors", "stablecoins"]) {
    try {
      const r = await db.execute(sql.raw(`SELECT COUNT(*)::int AS count FROM ${t}`));
      const rows = (r as unknown as { rows?: Array<{ count: number }> }).rows ?? (r as unknown as Array<{ count: number }>);
      results[t] = Array.isArray(rows) ? rows[0]?.count : rows;
    } catch (e) {
      results[t] = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  const url = new URL(process.env.DATABASE_URL!);
  results._host = url.host;

  return NextResponse.json(results);
}
