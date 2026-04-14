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

  const raw = process.env.DATABASE_URL ?? "";
  results._db_url_len = raw.length;
  results._db_url_prefix = raw.slice(0, 16);
  results._db_url_suffix = raw.slice(-20);
  try {
    const u = new URL(raw);
    results._parsed_hostname = u.hostname;
    results._parsed_port = u.port;
    results._parsed_pathname = u.pathname;
  } catch (e) {
    results._parse_error = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(results);
}
