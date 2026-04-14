import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getAllStablecoins } from "@/lib/pipeline/stablecoins";

export interface RefreshResult {
  stablesChecked: number;
  reservesUpdated: number;
}

// Refreshes reserves.backing_usd = on-chain totalSupply × current peg price.
// Only updates rows that already exist in the reserves table (set up via seed).
export async function refreshReserves(): Promise<RefreshResult> {
  const stables = await getAllStablecoins();
  let reservesUpdated = 0;

  for (const s of stables) {
    const supplyRaw = BigInt(s.current_supply || "0");
    const supplyTokens = Number(supplyRaw) / 1_000_000; // TIP-20 uses 6 decimals
    const price = Number(s.price_vs_pathusd) || 1;
    const backingUsd = supplyTokens * price;
    if (!isFinite(backingUsd) || backingUsd <= 0) continue;

    const addr = s.address.toLowerCase();
    const backingStr = backingUsd.toFixed(2);
    const r = await db.execute(sql`
      UPDATE reserves
      SET backing_usd = ${backingStr},
          attested_at = NOW(),
          updated_at = NOW()
      WHERE stable = ${addr}
      RETURNING reserve_type, attestation_source, verified_by, notes
    `);
    const updatedRows = ((r as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (r as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
    for (const row of updatedRows) {
      const notesJson = row.notes != null ? JSON.stringify(row.notes) : null;
      await db.execute(sql`
        INSERT INTO reserves_history
          (stable, reserve_type, backing_usd, attestation_source, verified_by, notes, attested_at)
        VALUES (
          ${addr},
          ${row.reserve_type as string},
          ${backingStr},
          ${(row.attestation_source as string | null) ?? null},
          ${(row.verified_by as string | null) ?? null},
          ${notesJson ? sql`${notesJson}::jsonb` : sql`NULL`},
          NOW()
        )
      `);
    }
    if (updatedRows.length > 0) reservesUpdated += 1;
  }

  return {
    stablesChecked: stables.length,
    reservesUpdated,
  };
}
