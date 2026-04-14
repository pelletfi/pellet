import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const r = await db.execute(sql`
    SELECT status, detail, checked_at
    FROM health_checks
    WHERE check_type = 'combined'
    ORDER BY checked_at DESC
    LIMIT 1
  `);
  const rows = ((r as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (r as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
  const latest = rows[0];
  if (!latest) return NextResponse.json({ status: "unknown" }, { status: 503 });

  const httpStatus = latest.status === "ok" ? 200 : 503;
  return NextResponse.json(
    {
      status: latest.status,
      details: latest.detail,
      checked_at: latest.checked_at,
    },
    { status: httpStatus },
  );
}
