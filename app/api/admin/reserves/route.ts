import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function authed(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

// POST — upsert a reserve entry. Body:
// { stable, reserve_type, backing_usd?, attestation_source?, attested_at?, verified_by?, notes? }
export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.stable || !body.reserve_type) {
    return NextResponse.json({ error: "stable and reserve_type required" }, { status: 400 });
  }

  const stable = String(body.stable).toLowerCase();
  await db.execute(sql`
    INSERT INTO reserves (stable, reserve_type, backing_usd, attestation_source, attested_at, verified_by, notes, updated_at)
    VALUES (
      ${stable},
      ${body.reserve_type},
      ${body.backing_usd ?? null},
      ${body.attestation_source ?? null},
      ${body.attested_at ?? null},
      ${body.verified_by ?? "manual"},
      ${body.notes ? JSON.stringify(body.notes) : null}::jsonb,
      NOW()
    )
    ON CONFLICT (stable, reserve_type) DO UPDATE SET
      backing_usd = EXCLUDED.backing_usd,
      attestation_source = EXCLUDED.attestation_source,
      attested_at = EXCLUDED.attested_at,
      verified_by = EXCLUDED.verified_by,
      notes = EXCLUDED.notes,
      updated_at = NOW()
  `);

  return NextResponse.json({ ok: true, stable, reserve_type: body.reserve_type });
}

// GET — list all reserves (admin utility)
export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await db.execute(sql`
    SELECT stable, reserve_type, backing_usd, attestation_source, attested_at, verified_by, notes, updated_at
    FROM reserves ORDER BY stable, reserve_type
  `);
  const rows = ((r as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (r as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
  return NextResponse.json({ reserves: rows });
}
