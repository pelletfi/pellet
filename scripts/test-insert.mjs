import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

try {
  const r = await sql`
    INSERT INTO peg_samples (stable, block_number, sampled_at, price_vs_pathusd, spread_bps)
    VALUES ('0x20c0000000000000000000000000000000000000', 14662852, '2026-04-14T05:15:55.000Z', '1', '0')
    RETURNING *
  `;
  console.log("OK:", r);
} catch (e) {
  console.error("ERROR:", e.message);
  console.error(e);
}
