import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function authed(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const limit = Math.min(200, parseInt(url.searchParams.get("limit") ?? "50", 10));
  const status = url.searchParams.get("status"); // 'pending'|'delivered'|'failed' or null

  let r;
  if (status === "pending" || status === "delivered" || status === "failed") {
    r = await db.execute(sql`
      SELECT id, subscription_id, event_type, status, attempts, next_attempt_at,
             delivered_at, last_error, created_at, payload
      FROM webhook_deliveries
      WHERE status = ${status}
      ORDER BY created_at DESC LIMIT ${limit}
    `);
  } else {
    r = await db.execute(sql`
      SELECT id, subscription_id, event_type, status, attempts, next_attempt_at,
             delivered_at, last_error, created_at, payload
      FROM webhook_deliveries
      ORDER BY created_at DESC LIMIT ${limit}
    `);
  }
  const rows = ((r as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (r as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;

  // Aggregate stats
  const stats = await db.execute(sql`
    SELECT status, COUNT(*)::int as count
    FROM webhook_deliveries
    GROUP BY status
  `);
  const statRows = ((stats as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (stats as unknown as Record<string, unknown>[])) as Array<{ status: string; count: number }>;
  const counts: Record<string, number> = { pending: 0, delivered: 0, failed: 0 };
  for (const s of statRows) counts[s.status] = Number(s.count);

  return NextResponse.json({ counts, deliveries: rows });
}
