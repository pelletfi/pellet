-- OAuth 2.1 substrate v1: client registry, authorization codes, access tokens.
--
-- Pellet wallet is both the authorization server and a resource server (the
-- MCP server). This migration sets up the storage; endpoints and the consent
-- UI ship in follow-up commits.
--
-- Client model — three registration approaches per MCP spec:
--   * 'cimd' (Client ID Metadata Document) — client_id IS the metadata URL,
--     metadata fetched + cached on first auth request. No pre-registration.
--   * 'pre' — manually registered with a fixed client_id, redirect_uris.
--   * 'dynamic' (RFC 7591) — registered via a /register endpoint (later).
--
-- Authorization codes — short-lived (60s), single-use, PKCE-bound. The
-- code_challenge + code_challenge_method are stored verbatim from the
-- /authorize request and verified at /token exchange.
--
-- Access tokens — bearer tokens stored as sha256 hashes (token_hash).
-- Audience-bound (RFC 8707): the resource the token was minted for. The
-- MCP server MUST refuse tokens whose audience doesn't match its own URI
-- to prevent token passthrough attacks.
--
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS "oauth_clients" (
  "client_id" text PRIMARY KEY,
  "user_id" uuid REFERENCES "wallet_users"("id") ON DELETE CASCADE,
  "client_name" text NOT NULL,
  -- 'cimd' | 'pre' | 'dynamic'
  "client_type" text NOT NULL,
  -- For CIMD clients: the metadata document URL (== client_id).
  "metadata_url" text,
  -- Cached client metadata JSON (RFC 7591 shape) — refreshed periodically.
  "metadata" jsonb,
  "metadata_fetched_at" timestamp with time zone,
  "redirect_uris" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "oauth_clients_user_idx"
  ON "oauth_clients" USING btree ("user_id")
  WHERE "user_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "oauth_authorization_codes" (
  "code_hash" text PRIMARY KEY,
  "client_id" text NOT NULL REFERENCES "oauth_clients"("client_id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "wallet_users"("id") ON DELETE CASCADE,
  "redirect_uri" text NOT NULL,
  "scopes" text[] NOT NULL,
  "audience" text NOT NULL,
  "code_challenge" text NOT NULL,
  "code_challenge_method" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "oauth_authz_codes_expires_idx"
  ON "oauth_authorization_codes" USING btree ("expires_at");

CREATE TABLE IF NOT EXISTS "oauth_access_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "client_id" text NOT NULL REFERENCES "oauth_clients"("client_id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "wallet_users"("id") ON DELETE CASCADE,
  -- Optional link to an agent session (Tempo Access Key). NULL until a
  -- paired session exists for this token.
  "session_id" uuid REFERENCES "wallet_sessions"("id") ON DELETE SET NULL,
  "scopes" text[] NOT NULL,
  "audience" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "last_used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "oauth_tokens_user_idx"
  ON "oauth_access_tokens" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "oauth_tokens_expires_idx"
  ON "oauth_access_tokens" USING btree ("expires_at")
  WHERE "revoked_at" IS NULL;
