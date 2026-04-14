import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function authed(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

// GET — current cursor position
export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await db.execute(sql`
    SELECT contract, last_block::int8 AS last_block, updated_at
    FROM ingestion_cursors
  `);
  const rows = ((r as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (r as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
  return NextResponse.json({
    cursors: rows.map((row) => ({
      contract: row.contract,
      last_block: Number(row.last_block),
      updated_at: row.updated_at,
    })),
  });
}

// POST — set cursor to a specific block. Body: { block: number }
// Use this to backfill: POST {block: 0} resets to start, then crons catch up.
export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const block = Number(body.block);
  if (!isFinite(block) || block < 0) {
    return NextResponse.json({ error: "block must be a non-negative number" }, { status: 400 });
  }
  await db.execute(sql`
    INSERT INTO ingestion_cursors (contract, last_block, updated_at)
    VALUES ('__global__', ${block}, NOW())
    ON CONFLICT (contract) DO UPDATE SET
      last_block = EXCLUDED.last_block,
      updated_at = NOW()
  `);
  return NextResponse.json({ ok: true, contract: "__global__", last_block: block });
}
