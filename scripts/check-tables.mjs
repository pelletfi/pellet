import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

const tables = ["events", "peg_samples", "ingestion_cursors", "stablecoins"];
for (const t of tables) {
  try {
    const r = await sql.query(`SELECT COUNT(*) FROM ${t}`);
    console.log(`${t.padEnd(22)} ${r[0].count}`);
  } catch (e) {
    console.log(`${t.padEnd(22)} ERROR: ${e.message}`);
  }
}
