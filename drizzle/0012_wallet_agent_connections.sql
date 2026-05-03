-- Durable wallet agent connections.
--
-- OAuth access tokens are intentionally short-lived, but the wallet UI needs
-- to remember that a user connected an agent even after the current bearer
-- expires. This table is the durable user/client relationship; tokens remain
-- the current credential material.

CREATE TABLE IF NOT EXISTS "wallet_agent_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "wallet_users"("id") ON DELETE CASCADE,
  "client_id" text NOT NULL REFERENCES "oauth_clients"("client_id") ON DELETE CASCADE,
  "last_token_id" uuid REFERENCES "oauth_access_tokens"("id") ON DELETE SET NULL,
  "last_session_id" uuid REFERENCES "wallet_sessions"("id") ON DELETE SET NULL,
  "last_scopes" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "last_audience" text,
  "connected_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "wallet_agent_connections_user_client_uq"
  ON "wallet_agent_connections" USING btree ("user_id", "client_id");

CREATE INDEX IF NOT EXISTS "wallet_agent_connections_user_idx"
  ON "wallet_agent_connections" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "wallet_agent_connections_client_idx"
  ON "wallet_agent_connections" USING btree ("client_id");

-- Backfill one durable connection per user/client from existing, non-revoked
-- tokens, including expired tokens. That keeps current users from seeing an
-- empty Agents page just because the bearer TTL elapsed.
INSERT INTO "wallet_agent_connections" (
  "user_id",
  "client_id",
  "last_token_id",
  "last_session_id",
  "last_scopes",
  "last_audience",
  "connected_at",
  "last_seen_at",
  "updated_at"
)
SELECT DISTINCT ON (t."user_id", t."client_id")
  t."user_id",
  t."client_id",
  t."id",
  t."session_id",
  t."scopes",
  t."audience",
  t."created_at",
  COALESCE(t."last_used_at", t."created_at"),
  now()
FROM "oauth_access_tokens" t
WHERE t."revoked_at" IS NULL
ORDER BY t."user_id", t."client_id", t."created_at" DESC
ON CONFLICT ("user_id", "client_id") DO UPDATE SET
  "last_token_id" = EXCLUDED."last_token_id",
  "last_session_id" = EXCLUDED."last_session_id",
  "last_scopes" = EXCLUDED."last_scopes",
  "last_audience" = EXCLUDED."last_audience",
  "last_seen_at" = EXCLUDED."last_seen_at",
  "updated_at" = now();
