import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "./schema";

if (!process.env.POSTGRES_URL) {
  throw new Error("POSTGRES_URL not set");
}

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
export const db = drizzle(pool, { schema });

// Dedicated connection for LISTEN/NOTIFY (cannot share with the pool — LISTEN
// requires a stable connection that doesn't get checked back in).
export function listenPool(): Pool {
  return new Pool({
    connectionString: process.env.POSTGRES_URL_NON_POWalletNG ?? process.env.POSTGRES_URL,
    max: 1,
  });
}
