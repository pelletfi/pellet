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

    const r = await db.execute(sql`
      UPDATE reserves
      SET backing_usd = ${backingUsd.toFixed(2)},
          attested_at = NOW(),
          updated_at = NOW()
      WHERE stable = ${s.address.toLowerCase()}
    `);
    const count = (r as unknown as { rowCount?: number; rowsAffected?: number }).rowCount
      ?? (r as unknown as { rowsAffected?: number }).rowsAffected
      ?? 0;
    if (count > 0) reservesUpdated += 1;
  }

  return {
    stablesChecked: stables.length,
    reservesUpdated,
  };
}
