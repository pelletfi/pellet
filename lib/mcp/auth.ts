import { eq, and, isNull, isNotNull, gt, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { walletUsers, walletSessions } from "@/lib/db/schema";
import { mcpResourceUrl, issuerUrl } from "@/lib/oauth/issuer";
import {
  bearerFromAuthHeader,
  validateAccessToken,
  type ValidatedToken,
} from "@/lib/oauth/tokens";
import {
  getConnectedAgentForClient,
  type ConnectedAgent,
} from "@/lib/db/wallet-agent-connections";
import type { ScopeName } from "@/lib/oauth/scopes";

// MCP-side auth: validate the bearer token from /mcp requests against the
// OAuth substrate. Audience-bound to the MCP resource URL — tokens minted
// for any other audience are rejected.
//
// Returns either a fully-resolved AuthInfo (token + user + optional session)
// or a Response that the route handler should return verbatim. The 401
// response includes the WWW-Authenticate header per RFC 9728 so MCP clients
// can discover the resource metadata + the authorization server.

export type McpAuthInfo = {
  token: ValidatedToken;
  user: {
    id: string;
    managedAddress: string;
    publicKeyUncompressed: string | null;
  };
  session: typeof walletSessions.$inferSelect | null;
  connection: ConnectedAgent | null;
};

function wwwAuthenticate(): string {
  const resourceMetadata = `${issuerUrl()}/.well-known/oauth-protected-resource`;
  return `Bearer realm="pellet", resource_metadata="${resourceMetadata}"`;
}

export function unauthorizedResponse(reason: string): Response {
  return new Response(JSON.stringify({ error: "unauthorized", error_description: reason }), {
    status: 401,
    headers: {
      "content-type": "application/json",
      "www-authenticate": wwwAuthenticate(),
    },
  });
}

export function forbiddenResponse(reason: string): Response {
  return new Response(JSON.stringify({ error: "forbidden", error_description: reason }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}

// Validates the incoming MCP request and returns the resolved auth context,
// OR a Response (401/403) that the route should return as-is.
export async function authenticateMcpRequest(
  req: Request,
): Promise<McpAuthInfo | Response> {
  const bearer = bearerFromAuthHeader(req);
  if (!bearer) return unauthorizedResponse("missing bearer token");

  const token = await validateAccessToken(bearer, mcpResourceUrl());
  if (!token) return unauthorizedResponse("invalid or expired token");

  // Resolve the user — tokens are per-user and we need the managed address
  // to call wallet APIs in tool handlers.
  const userRows = await db
    .select({
      id: walletUsers.id,
      managedAddress: walletUsers.managedAddress,
      publicKeyUncompressed: walletUsers.publicKeyUncompressed,
    })
    .from(walletUsers)
    .where(eq(walletUsers.id, token.userId))
    .limit(1);
  const user = userRows[0];
  if (!user) return forbiddenResponse("token user not found");

  // Session linkage: the Tempo Access Key the agent acts under.
  // Prefer the explicit link on the token; fall back to the user's most
  // recent active+authorized session so re-auth via new DCR clients
  // doesn't break spending.
  let session: typeof walletSessions.$inferSelect | null = null;
  if (token.sessionId) {
    const rows = await db
      .select()
      .from(walletSessions)
      .where(
        and(
          eq(walletSessions.id, token.sessionId),
          isNull(walletSessions.revokedAt),
        ),
      )
      .limit(1);
    session = rows[0] ?? null;
  }
  if (!session) {
    const rows = await db
      .select()
      .from(walletSessions)
      .where(
        and(
          eq(walletSessions.userId, token.userId),
          isNull(walletSessions.revokedAt),
          isNotNull(walletSessions.authorizeTxHash),
          gt(walletSessions.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(walletSessions.createdAt))
      .limit(1);
    session = rows[0] ?? null;
  }

  const connection = await getConnectedAgentForClient({
    userId: user.id,
    clientId: token.clientId,
  });

  return { token, user, session, connection };
}

export class ScopeError extends Error {
  constructor(public readonly required: ScopeName) {
    super(`requires scope: ${required}`);
    this.name = "ScopeError";
  }
}

export function requireScope(auth: McpAuthInfo, required: ScopeName): void {
  if (!auth.token.scopes.includes(required)) {
    throw new ScopeError(required);
  }
}
