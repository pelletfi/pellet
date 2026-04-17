// Exercises the holder-snapshot cron builder once and prints the per-token
// results.  Use to verify end-to-end before letting the scheduled cron run
// in prod.
//
//   node --env-file=.env.local scripts/test-holder-snapshot.mjs
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

// Hit the dev server's cron endpoint so the cron runs inside Next.js's
// module context (shares the tempoClient singleton, etc).
const res = await fetch("http://localhost:3000/api/cron/holder-snapshot", {
  method: "GET",
});
const json = await res.json();
console.log("cron result:", JSON.stringify(json, null, 2));

const sql = neon(url);
const rows = await sql`
  SELECT stable, total_holders, coverage, coverage_note, as_of_block, computed_at
  FROM holder_snapshots
  ORDER BY computed_at DESC
`;
console.log(`\nsnapshots in DB: ${rows.length}`);
for (const r of rows) {
  console.log(
    `  ${r.stable}  holders=${r.total_holders}  coverage=${r.coverage}  asOfBlock=${r.as_of_block}  computed=${r.computed_at}`,
  );
  if (r.coverage_note) {
    console.log(`    note: ${r.coverage_note.slice(0, 120)}`);
  }
}
