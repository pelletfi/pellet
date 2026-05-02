-- OAuth client webhook destinations.
--
-- Adds the URL Pellet POSTs user-side chat messages to + the HMAC secret
-- the client uses to verify the payload. When a wallet user posts a reply
-- in their chat thread, the bus dispatcher looks up every distinct client
-- with a webhook_url for that user (across all their access tokens) and
-- fires one POST per client.
--
-- webhook_secret is the raw hex used for HMAC. NOT a hash. We need it on
-- every dispatch to sign the payload — surfaced once on the client-set
-- flow and never returned again. Same pattern as oli_webhook_subscriptions.
--
-- Idempotent — safe to re-run.

ALTER TABLE "oauth_clients" ADD COLUMN IF NOT EXISTS "webhook_url" text;
ALTER TABLE "oauth_clients" ADD COLUMN IF NOT EXISTS "webhook_secret" text;

CREATE INDEX IF NOT EXISTS "oauth_clients_webhook_url_idx"
  ON "oauth_clients" USING btree ("webhook_url")
  WHERE "webhook_url" IS NOT NULL;
