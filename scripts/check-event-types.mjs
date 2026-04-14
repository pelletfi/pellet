import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

const r = await sql`
  SELECT event_type, COUNT(*)::int as count
  FROM events
  GROUP BY event_type
  ORDER BY count DESC
  LIMIT 15
`;
console.log("Top event types (topic0):");
for (const row of r) {
  console.log(`  ${row.event_type}  ${row.count}`);
}

console.log("\nTotal events:", (await sql`SELECT COUNT(*)::int as c FROM events`)[0].c);
