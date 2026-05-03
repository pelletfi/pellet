import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  oauthAccessTokens,
  walletAgentConnections,
} from "@/lib/db/schema";
import type { ScopeName } from "@/lib/oauth/scopes";

type ClientType = "cimd" | "pre" | "dynamic";
type TokenState = "active" | "expired" | "revoked" | "missing";

export type ConnectedAgent = {
  id: string;
  clientId: string;
  clientName: string;
  clientType: ClientType;
  scopes: ScopeName[];
  audience: string | null;
  connectedAt: Date;
  lastSeenAt: Date;
  tokenId: string | null;
  tokenCreatedAt: Date | null;
  tokenExpiresAt: Date | null;
  tokenLastUsedAt: Date | null;
  tokenState: TokenState;
  activeTokenCount: number;
  webhookEnabled: boolean;
  sessionId: string | null;
};

type ConnectedAgentRow = {
  id: string;
  client_id: string;
  client_name: string;
  client_type: string;
  webhook_enabled: boolean;
  last_scopes: string[] | null;
  last_audience: string | null;
  connected_at: Date | string;
  last_seen_at: Date | string;
  last_session_id: string | null;
  token_id: string | null;
  token_scopes: string[] | null;
  token_audience: string | null;
  token_created_at: Date | string | null;
  token_expires_at: Date | string | null;
  token_last_used_at: Date | string | null;
  token_revoked_at: Date | string | null;
  active_token_count: number;
};

export type RecordAgentConnectionInput = {
  userId: string;
  clientId: string;
  tokenId: string;
  sessionId?: string | null;
  scopes: ScopeName[];
  audience: string;
};

export async function recordAgentConnection(
  input: RecordAgentConnectionInput,
): Promise<void> {
  const now = new Date();
  await db
    .insert(walletAgentConnections)
    .values({
      userId: input.userId,
      clientId: input.clientId,
      lastTokenId: input.tokenId,
      lastSessionId: input.sessionId ?? null,
      lastScopes: input.scopes,
      lastAudience: input.audience,
      lastSeenAt: now,
      updatedAt: now,
      revokedAt: null,
    })
    .onConflictDoUpdate({
      target: [
        walletAgentConnections.userId,
        walletAgentConnections.clientId,
      ],
      set: {
        lastTokenId: input.tokenId,
        lastSessionId: input.sessionId ?? null,
        lastScopes: input.scopes,
        lastAudience: input.audience,
        lastSeenAt: now,
        revokedAt: null,
        updatedAt: now,
      },
    });
}

export async function touchAgentConnectionUse(input: {
  userId: string;
  clientId: string;
  tokenId?: string;
  sessionId?: string | null;
}): Promise<void> {
  const now = new Date();
  const set: Partial<typeof walletAgentConnections.$inferInsert> = {
    lastSeenAt: now,
    updatedAt: now,
  };
  if (input.tokenId) set.lastTokenId = input.tokenId;
  if (input.sessionId) set.lastSessionId = input.sessionId;

  await db
    .update(walletAgentConnections)
    .set(set)
    .where(
      and(
        eq(walletAgentConnections.userId, input.userId),
        eq(walletAgentConnections.clientId, input.clientId),
        isNull(walletAgentConnections.revokedAt),
      ),
    );
}

function toDate(value: Date | string | null): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function tokenState(row: ConnectedAgentRow, expiresAt: Date | null): TokenState {
  if (!row.token_id || !expiresAt) return "missing";
  if (row.token_revoked_at) return "revoked";
  if (expiresAt.getTime() <= Date.now()) return "expired";
  return "active";
}

function clientType(value: string): ClientType {
  if (value === "cimd" || value === "pre" || value === "dynamic") return value;
  return "dynamic";
}

export async function listConnectedAgents(
  userId: string,
): Promise<ConnectedAgent[]> {
  const rows = await db.execute<ConnectedAgentRow>(sql`
    SELECT
      cxn.id,
      cxn.client_id,
      c.client_name,
      c.client_type,
      (c.webhook_url IS NOT NULL) AS webhook_enabled,
      cxn.last_scopes,
      cxn.last_audience,
      cxn.connected_at,
      cxn.last_seen_at,
      cxn.last_session_id,
      t.id AS token_id,
      t.scopes AS token_scopes,
      t.audience AS token_audience,
      t.created_at AS token_created_at,
      t.expires_at AS token_expires_at,
      t.last_used_at AS token_last_used_at,
      t.revoked_at AS token_revoked_at,
      COALESCE(active.active_token_count, 0)::int AS active_token_count
    FROM wallet_agent_connections cxn
    INNER JOIN oauth_clients c ON c.client_id = cxn.client_id
    LEFT JOIN oauth_access_tokens t ON t.id = cxn.last_token_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS active_token_count
      FROM oauth_access_tokens at
      WHERE at.user_id = cxn.user_id
        AND at.client_id = cxn.client_id
        AND at.revoked_at IS NULL
        AND at.expires_at > now()
    ) active ON true
    WHERE cxn.user_id = ${userId}
      AND cxn.revoked_at IS NULL
    ORDER BY cxn.last_seen_at DESC, cxn.connected_at DESC
  `);

  return rows.rows.map((row) => {
    const scopes = row.token_scopes?.length
      ? row.token_scopes
      : row.last_scopes ?? [];
    const connectedAt = toDate(row.connected_at) ?? new Date(0);
    const lastSeenAt = toDate(row.token_last_used_at) ?? toDate(row.last_seen_at) ?? connectedAt;
    const tokenCreatedAt = toDate(row.token_created_at);
    const tokenExpiresAt = toDate(row.token_expires_at);
    const tokenLastUsedAt = toDate(row.token_last_used_at);
    return {
      id: row.id,
      clientId: row.client_id,
      clientName: row.client_name,
      clientType: clientType(row.client_type),
      scopes: scopes as ScopeName[],
      audience: row.token_audience ?? row.last_audience,
      connectedAt,
      lastSeenAt,
      tokenId: row.token_id,
      tokenCreatedAt,
      tokenExpiresAt,
      tokenLastUsedAt,
      tokenState: tokenState(row, tokenExpiresAt),
      activeTokenCount: Number(row.active_token_count ?? 0),
      webhookEnabled: row.webhook_enabled,
      sessionId: row.last_session_id,
    };
  });
}

export async function revokeAgentConnection(input: {
  userId: string;
  connectionId: string;
}): Promise<{ id: string; clientId: string; revokedTokenCount: number } | null> {
  const now = new Date();
  const updated = await db
    .update(walletAgentConnections)
    .set({ revokedAt: now, updatedAt: now })
    .where(
      and(
        eq(walletAgentConnections.id, input.connectionId),
        eq(walletAgentConnections.userId, input.userId),
      ),
    )
    .returning({
      id: walletAgentConnections.id,
      clientId: walletAgentConnections.clientId,
    });
  const connection = updated[0];
  if (!connection) return null;

  const revokedTokens = await db
    .update(oauthAccessTokens)
    .set({ revokedAt: now })
    .where(
      and(
        eq(oauthAccessTokens.userId, input.userId),
        eq(oauthAccessTokens.clientId, connection.clientId),
        isNull(oauthAccessTokens.revokedAt),
      ),
    )
    .returning({ id: oauthAccessTokens.id });

  return {
    id: connection.id,
    clientId: connection.clientId,
    revokedTokenCount: revokedTokens.length,
  };
}
