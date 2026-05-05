import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { oauthAuthorizationCodes } from "@/lib/db/schema";
import type { ScopeName } from "./scopes";
import type { CodeChallengeMethod } from "./pkce";

// Authorization codes are 32 bytes of crypto-random data, base64url-encoded
// (~43 chars). They live for 60 seconds and are single-use — `consumed_at`
// is set atomically inside `consumeAuthorizationCode` so a replay race
// can't produce two valid token mints.

const CODE_TTL_MS = 60 * 1000;

function base64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function generateCode(): string {
  return base64Url(randomBytes(32));
}

export type IssueAuthorizationCodeInput = {
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes: ScopeName[];
  audience: string;
  codeChallenge: string;
  codeChallengeMethod: CodeChallengeMethod;
};

export async function issueAuthorizationCode(
  input: IssueAuthorizationCodeInput,
): Promise<{ code: string; expiresAt: Date }> {
  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  await db.insert(oauthAuthorizationCodes).values({
    codeHash,
    clientId: input.clientId,
    userId: input.userId,
    redirectUri: input.redirectUri,
    scopes: input.scopes,
    audience: input.audience,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: input.codeChallengeMethod,
    expiresAt,
  });
  return { code, expiresAt };
}

export type AuthorizationCodeRow = {
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes: string[];
  audience: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  expiresAt: Date;
};

// Atomically marks the code consumed AND returns the row, only if not
// already consumed and not expired. Race-safe: two concurrent /token
// requests for the same code will see exactly one success.
export async function consumeAuthorizationCode(
  code: string,
): Promise<AuthorizationCodeRow | null> {
  const codeHash = hashCode(code);
  const now = new Date();
  const updated = await db
    .update(oauthAuthorizationCodes)
    .set({ consumedAt: now })
    .where(
      and(
        eq(oauthAuthorizationCodes.codeHash, codeHash),
        isNull(oauthAuthorizationCodes.consumedAt),
        gt(oauthAuthorizationCodes.expiresAt, now),
      ),
    )
    .returning();
  const row = updated[0];
  if (!row) return null;
  return {
    clientId: row.clientId,
    userId: row.userId,
    redirectUri: row.redirectUri,
    scopes: row.scopes,
    audience: row.audience,
    codeChallenge: row.codeChallenge,
    codeChallengeMethod: row.codeChallengeMethod,
    expiresAt: row.expiresAt,
  };
}

// Best-effort GC. Run from a periodic cron, or inline as opportunistic
// cleanup. Idempotent.
export async function pruneExpiredCodes(): Promise<number> {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);
  const deleted = await db
    .delete(oauthAuthorizationCodes)
    .where(lt(oauthAuthorizationCodes.expiresAt, cutoff))
    .returning({ codeHash: oauthAuthorizationCodes.codeHash });
  return deleted.length;
}
