import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export interface AuthResult {
  /** Resolved caller identity. `"admin"` for CRON_SECRET, the api_key string
   * for a Pellet Pro subscriber, or `null` when the request is unauthenticated. */
  identity: "admin" | string | null;
  /** Convenience flag for admin-gated routes. */
  isAdmin: boolean;
  /** When `identity` is a subscriber key, the email on file. */
  subscriberEmail?: string | null;
}

/** Resolve the caller's identity from an Authorization or X-Pellet-Key header.
 *
 * Recognised forms:
 *   - `Authorization: Bearer <CRON_SECRET>` → admin
 *   - `Authorization: Bearer pellet_...` → Pellet Pro subscriber (via api_key lookup)
 *   - `X-Pellet-Key: pellet_...` → same subscriber path, alternative header
 *
 * Returns `{ identity: null, isAdmin: false }` for unrecognised / invalid creds.
 * Callers decide how to respond — some routes accept either admin or subscriber;
 * others require one specifically.
 */
export async function resolveAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("authorization") ?? "";
  const keyHeader = req.headers.get("x-pellet-key") ?? "";

  // Admin path first — CRON_SECRET overrides everything for operational access.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { identity: "admin", isAdmin: true };
  }

  // Pellet Pro subscriber key — in either Authorization or X-Pellet-Key header.
  let apiKey: string | null = null;
  if (authHeader.startsWith("Bearer pellet_")) {
    apiKey = authHeader.slice("Bearer ".length);
  } else if (keyHeader.startsWith("pellet_")) {
    apiKey = keyHeader;
  }

  if (!apiKey) return { identity: null, isAdmin: false };

  const r = await db.execute(sql`
    SELECT api_key, email, status
    FROM pellet_pro_subscribers
    WHERE api_key = ${apiKey}
    LIMIT 1
  `);
  const rows = ((r as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (r as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
  const row = rows[0];
  if (!row) return { identity: null, isAdmin: false };
  if (row.status && row.status !== "active") {
    return { identity: null, isAdmin: false };
  }

  return {
    identity: String(row.api_key),
    isAdmin: false,
    subscriberEmail: (row.email as string | null) ?? null,
  };
}
