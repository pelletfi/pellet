-- Pellet Wallet · defer on-chain authorize until first spend.
--
-- Pre-2026-05-09 the browser broadcast the AccountKeychain.authorizeKey tx
-- inline during signup and waited for the receipt before bearer issuance.
-- That coupled signup to Tempo's protocol availability — when Presto's
-- FeeAMM ran dry, signup wedged with "insufficient liquidity in FeeAMM
-- pool to swap fee tokens".
--
-- New flow: browser passkey-signs the tx envelope (relay-uncosigned),
-- POSTs raw bytes here. Server stores them and issues the bearer
-- immediately. First time the agent attempts a spend, bearer-auth
-- relay-cosigns + broadcasts inline. If FeeAMM is still dry at that
-- point, the spend fails with a clear error — but signup succeeded.
--
-- Idempotent — safe to re-run.

ALTER TABLE "wallet_sessions" ADD COLUMN IF NOT EXISTS "authorize_tx_signed" text;
ALTER TABLE "wallet_sessions" ADD COLUMN IF NOT EXISTS "authorize_state" text NOT NULL DEFAULT 'pending';
ALTER TABLE "wallet_sessions" ADD COLUMN IF NOT EXISTS "authorize_attempts" integer NOT NULL DEFAULT 0;
ALTER TABLE "wallet_sessions" ADD COLUMN IF NOT EXISTS "authorize_last_error" text;
ALTER TABLE "wallet_sessions" ADD COLUMN IF NOT EXISTS "authorize_valid_before" timestamp with time zone;

-- Existing rows that already have authorize_tx_hash set are confirmed
-- on-chain. Mark their state accordingly so the new lazy-broadcast path
-- short-circuits for them.
UPDATE "wallet_sessions"
   SET "authorize_state" = 'confirmed'
 WHERE "authorize_tx_hash" IS NOT NULL
   AND "authorize_state" = 'pending';

-- Lookup index for the lazy-broadcast worker / inline-broadcast path:
-- find sessions still waiting on-chain.
CREATE INDEX IF NOT EXISTS "wallet_sessions_authorize_state_idx"
  ON "wallet_sessions" USING btree ("authorize_state")
  WHERE "authorize_state" IN ('pending', 'broadcasting', 'failed');
