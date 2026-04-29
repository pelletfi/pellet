-- Pellet Wallet · Phase 1 schema. Path B (self-custody, passkey-rooted).
--
-- This migration is intentionally signing-key-agnostic. wallet_users stores
-- only WebAuthn credential metadata + a managed Tempo address; key material
-- itself is never persisted server-side (passkey PRF derives the seed
-- on-device per signature in B1 mode, or wraps a session key in B2 mode —
-- either way Pellet doesn't hold raw private keys).
--
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS "wallet_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- WebAuthn credential identifier (base64url). One credential per row;
  -- multiple credentials per user can be modelled later as a 1:N table.
  "passkey_credential_id" text NOT NULL UNIQUE,
  -- The user's WebAuthn public key, COSE-encoded (bytea). Used to verify
  -- assertion signatures during sign-in / signing approval.
  "passkey_public_key" bytea NOT NULL,
  -- The Tempo address Pellet manages for this user. Derived from a
  -- passkey-PRF-wrapped seed; the address itself is public, the seed is not.
  "managed_address" text NOT NULL UNIQUE,
  -- Optional handle the user picks (email, alias). Not used for auth.
  "display_name" text,
  -- Sign-counter from the most recent assertion — replay protection.
  "passkey_sign_count" bigint NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_seen_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "wallet_users_managed_address_idx"
  ON "wallet_users" USING btree ("managed_address");

CREATE TABLE IF NOT EXISTS "wallet_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "wallet_users"("id") ON DELETE CASCADE,
  -- SHA-256 of the bearer token agents use to authenticate. Raw token is
  -- shown to the user once at session creation; we never store it cleartext.
  "bearer_token_hash" text NOT NULL UNIQUE,
  -- Total spend cap over the session lifetime, in USDC.e wei (uint256 → text).
  "spend_cap_wei" text NOT NULL,
  -- Running tally of what's been spent this session. Updated atomically on
  -- each accepted payment. Compared against spend_cap_wei before signing.
  "spend_used_wei" text NOT NULL DEFAULT '0',
  -- Per-call cap (smaller than spend_cap_wei). Defends against a single
  -- compromised request draining the whole session.
  "per_call_cap_wei" text NOT NULL,
  -- Optional allowlist of recipient addresses. NULL = any recipient.
  "recipient_allowlist" jsonb,
  -- B2 mode: session-key ciphertext, encrypted with a key derived from the
  -- user's passkey via WebAuthn PRF at session creation time. Pellet can
  -- decrypt only by going through a passkey assertion, OR (in B2-relaxed)
  -- by combining server master + passkey-bound wrapping. NULL in B1 mode
  -- (no session key — every signature requires a passkey prompt).
  "session_key_ciphertext" bytea,
  -- Display label the user picks at creation ("claude-code · daily").
  "label" text,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "wallet_sessions_user_idx"
  ON "wallet_sessions" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "wallet_sessions_expires_idx"
  ON "wallet_sessions" USING btree ("expires_at")
  WHERE "revoked_at" IS NULL;

CREATE TABLE IF NOT EXISTS "wallet_spend_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" uuid NOT NULL REFERENCES "wallet_sessions"("id") ON DELETE RESTRICT,
  -- Denormalised for fast per-user audit queries (joins to sessions are
  -- otherwise required for every "show me my history" lookup).
  "user_id" uuid NOT NULL REFERENCES "wallet_users"("id") ON DELETE CASCADE,
  -- The 402 challenge id we signed against, if known. Identifies the
  -- request the agent was responding to.
  "challenge_id" text,
  "recipient" text NOT NULL,
  "amount_wei" text NOT NULL,
  -- Set once we've broadcast / observed the tx; nullable until confirmed.
  "tx_hash" text,
  -- Lifecycle: 'pending' → 'signed' → 'submitted' → 'confirmed' | 'failed'.
  -- 'rejected' = caps tripped or recipient not allowlisted; we never signed.
  "status" text NOT NULL DEFAULT 'pending',
  -- Free-text reason on rejection / failure (cap exceeded, recipient
  -- not allowed, broadcast failed, etc.). Helps the user audit.
  "reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "wallet_spend_log_session_idx"
  ON "wallet_spend_log" USING btree ("session_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "wallet_spend_log_user_idx"
  ON "wallet_spend_log" USING btree ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "wallet_spend_log_tx_idx"
  ON "wallet_spend_log" USING btree ("tx_hash")
  WHERE "tx_hash" IS NOT NULL;

-- pgcrypto is needed for gen_random_uuid() on older Postgres; Neon includes
-- it by default but enable defensively.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
