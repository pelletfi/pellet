import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { oauthAccessTokens } from "@/lib/db/schema";
import { touchAgentConnectionUse } from "@/lib/db/wallet-agent-connections";
import type { ScopeName } from "./scopes";

// Access tokens are 32 bytes of crypto-random data, base64url-encoded.
// Stored as sha256 hash (not the raw token) so a DB read can't yield
// usable bearer credentials.
//
// Audience binding (RFC 8707): every token is minted FOR a specific
// resource URI (the MCP server's address). Resource servers MUST verify
// `audience` matches their own URI before serving — this prevents a token
// minted for resource A from being replayed against resource B.
//
// Default TTL is 1 hour. Refresh tokens are not implemented in v1; clients
// re-authorize when their token expires (the agent can keep a long-lived
// PKCE handshake state if needed, or the user can re-approve via a fresh
// OAuth flow). Refresh-token support comes in Phase 2.

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function base64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateAccessToken(): string {
  return base64Url(randomBytes(32));
}

export type IssueAccessTokenInput = {
  clientId: string;
  userId: string;
  sessionId?: string | null;
  scopes: ScopeName[];
  audience: string;
  ttlMs?: number;
};

export async function issueAccessToken(input: IssueAccessTokenInput): Promise<{
  token: string;
  tokenId: string;
  expiresAt: Date;
}> {
  const token = generateAccessToken();
  const tokenHash = hashToken(token);
  const ttl = input.ttlMs ?? TOKEN_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl);
  const [row] = await db
    .insert(oauthAccessTokens)
    .values({
      tokenHash,
      clientId: input.clientId,
      userId: input.userId,
      sessionId: input.sessionId ?? null,
      scopes: input.scopes,
      audience: input.audience,
      expiresAt,
    })
    .returning({ id: oauthAccessTokens.id });
  return { token, tokenId: row.id, expiresAt };
}

export type ValidatedToken = {
  tokenId: string;
  clientId: string;
  userId: string;
  sessionId: string | null;
  scopes: ScopeName[];
  audience: string;
  expiresAt: Date;
};

// Validates a bearer token AND its audience. Returns null if:
//   * token is unknown, revoked, or expired
//   * audience doesn't match the expected resource URI
//
// Updates last_used_at on hit for "when did this client last call" tracking.
// Audience match is strict equality — no prefix matching, no scheme coercion.
export async function validateAccessToken(
  rawToken: string,
  expectedAudience: string,
): Promise<ValidatedToken | null> {
  const tokenHash = hashToken(rawToken);
  const rows = await db
    .select()
    .from(oauthAccessTokens)
    .where(eq(oauthAccessTokens.tokenHash, tokenHash))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  // Audience binding check. Strict-equal both sides via timingSafeEqual.
  const a = Buffer.from(row.audience, "utf8");
  const b = Buffer.from(expectedAudience, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  // Best-effort touch — don't block validation on this update succeeding.
  void db
    .update(oauthAccessTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(oauthAccessTokens.id, row.id))
    .catch(() => {});
  void touchAgentConnectionUse({
    userId: row.userId,
    clientId: row.clientId,
    tokenId: row.id,
    sessionId: row.sessionId,
  }).catch(() => {});

  return {
    tokenId: row.id,
    clientId: row.clientId,
    userId: row.userId,
    sessionId: row.sessionId,
    scopes: row.scopes as ScopeName[],
    audience: row.audience,
    expiresAt: row.expiresAt,
  };
}

export async function revokeAccessToken(tokenId: string): Promise<boolean> {
  const updated = await db
    .update(oauthAccessTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(oauthAccessTokens.id, tokenId), isNull(oauthAccessTokens.revokedAt)),
    )
    .returning({ id: oauthAccessTokens.id });
  return updated.length > 0;
}

export function bearerFromAuthHeader(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer (.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}
