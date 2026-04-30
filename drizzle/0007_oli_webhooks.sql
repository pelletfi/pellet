-- OLI Webhooks v1: subscriptions + deliveries.
--
-- Subscriptions own a callback_url + signing_secret + filter spec. Every
-- agent_events insert is fanned out to matching subscriptions via the
-- dispatcher (lib/oli/webhooks/dispatcher.ts). The (subscription_id, event_id)
-- unique index is the hard idempotency guarantee — the bus listener AND the
-- inline match-runner hook both INSERT, ON CONFLICT DO NOTHING makes the
-- double-call safe.
--
-- signing_secret is the raw hex used for HMAC. NOT a hash. We need it on
-- every dispatch to sign the payload. Surfaced once on create + once on rotate;
-- never returned otherwise.
--
-- Cascade-delete from wallet_users: deleting a wallet_users row drops the
-- subscriptions and (transitively) the deliveries. agent_events.id cascade
-- ensures we don't accumulate orphan delivery rows if an event is ever pruned.
--
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS "oli_webhook_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL REFERENCES "wallet_users"("id") ON DELETE CASCADE,
  "callback_url" text NOT NULL,
  "signing_secret" text NOT NULL,
  "label" text,
  "filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'pending_verify' NOT NULL,
  "verify_token" text,
  "verify_token_expires_at" timestamp with time zone,
  "verified_at" timestamp with time zone,
  "consecutive_failures" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_delivered_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "oli_webhook_subs_owner_idx"
  ON "oli_webhook_subscriptions" USING btree ("owner_user_id");
CREATE INDEX IF NOT EXISTS "oli_webhook_subs_status_idx"
  ON "oli_webhook_subscriptions" USING btree ("status");
-- Expression index — lets dispatchToWebhooks short-list subscriptions by
-- the event's recipient address without scanning the full table.
CREATE INDEX IF NOT EXISTS "oli_webhook_subs_recipient_idx"
  ON "oli_webhook_subscriptions" USING btree (("filters" ->> 'recipient_address'));

CREATE TABLE IF NOT EXISTS "oli_webhook_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subscription_id" uuid NOT NULL REFERENCES "oli_webhook_subscriptions"("id") ON DELETE CASCADE,
  "event_id" integer NOT NULL REFERENCES "agent_events"("id") ON DELETE CASCADE,
  "delivery_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "response_code" integer,
  "response_body_excerpt" text,
  "next_retry_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "last_attempt_at" timestamp with time zone,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Hard idempotency guarantee: at most one delivery row per (subscription, event).
CREATE UNIQUE INDEX IF NOT EXISTS "oli_webhook_deliveries_sub_event_uq"
  ON "oli_webhook_deliveries" USING btree ("subscription_id", "event_id");
CREATE INDEX IF NOT EXISTS "oli_webhook_deliveries_retry_ready_idx"
  ON "oli_webhook_deliveries" USING btree ("status", "next_retry_at");
CREATE INDEX IF NOT EXISTS "oli_webhook_deliveries_delivery_id_idx"
  ON "oli_webhook_deliveries" USING btree ("delivery_id");
CREATE INDEX IF NOT EXISTS "oli_webhook_deliveries_sub_status_idx"
  ON "oli_webhook_deliveries" USING btree ("subscription_id", "status");
