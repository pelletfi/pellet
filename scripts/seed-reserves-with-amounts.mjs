// Populates reserves.backing_usd from live API data.
// For each stable: backing_usd = current_supply (in tokens) * peg_price (vs pathUSD @ $1).
// Run: node --env-file=.env.local scripts/seed-reserves-with-amounts.mjs
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

const res = await fetch("https://www.pelletfi.com/api/v1/stablecoins");
if (!res.ok) {
  console.error("Failed to fetch stablecoins:", res.status);
  process.exit(1);
}
const { stablecoins } = await res.json();

console.log("stable              supply(tokens)    price     backing_usd");
console.log("──────────────────────────────────────────────────────────");

let updated = 0;
for (const s of stablecoins) {
  const supplyRaw = BigInt(s.current_supply || "0");
  const supplyTokens = Number(supplyRaw) / 1_000_000;
  const price = Number(s.price_vs_pathusd) || 1;
  const backingUsd = supplyTokens * price;

  if (!isFinite(backingUsd) || backingUsd <= 0) {
    console.log(`${s.symbol.padEnd(18)} ${"0".padStart(16)}  ${price.toFixed(4)}   $0.00`);
    continue;
  }

  console.log(`${s.symbol.padEnd(18)} ${supplyTokens.toFixed(2).padStart(16)}  ${price.toFixed(4)}   $${backingUsd.toFixed(2)}`);

  await sql`
    UPDATE reserves
    SET backing_usd = ${backingUsd.toFixed(2)},
        attested_at = NOW(),
        updated_at = NOW()
    WHERE stable = ${s.address.toLowerCase()}
  `;
  updated += 1;
}

console.log(`\nUpdated backing_usd on ${updated} stables.`);
