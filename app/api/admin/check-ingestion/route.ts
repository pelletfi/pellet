import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sql = neon(process.env.DATABASE_URL!);
  const results: Record<string, unknown> = {};

  for (const t of ["events", "peg_samples", "ingestion_cursors", "stablecoins"]) {
    try {
      const r = await sql.query(`SELECT COUNT(*)::int AS count FROM ${t}`);
      results[t] = r[0]?.count ?? 0;
    } catch (e) {
      results[t] = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  // Also report DATABASE_URL host (not password) to confirm which DB we're hitting
  const url = new URL(process.env.DATABASE_URL!);
  results._host = url.host;

  return NextResponse.json(results);
}
