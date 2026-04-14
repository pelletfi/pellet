// Applies pending SQL files in drizzle/ sorted by filename.
// Records applied migrations in a `_migrations` table.
// Run via: node --env-file=.env.local scripts/migrate.mjs
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}
const sql = neon(url);

await sql`
  CREATE TABLE IF NOT EXISTS _migrations (
    name text PRIMARY KEY,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
  )
`;

const dir = path.join(process.cwd(), "drizzle");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  const rows = await sql`SELECT 1 FROM _migrations WHERE name = ${file}`;
  if (rows.length > 0) {
    console.log(`skip  ${file}`);
    continue;
  }
  const text = readFileSync(path.join(dir, file), "utf8");
  console.log(`apply ${file}`);
  // Neon HTTP driver requires one statement per call — split on `;` and run sequentially.
  const stripComments = (s) =>
    s.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n").trim();
  const statements = text
    .split(/;\s*\n/)
    .map(stripComments)
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    console.log(`  > ${stmt.split("\n")[0].slice(0, 80)}...`);
    await sql.query(stmt);
  }
  await sql`INSERT INTO _migrations (name) VALUES (${file})`;
}

console.log("done");
