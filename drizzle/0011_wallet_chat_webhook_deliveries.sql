-- Idempotency log for wallet chat webhook dispatch.
--
-- Multiple Vercel function instances all run their own bus + LISTEN, so
-- every NOTIFY on wallet_chat is received by every instance. Without
-- dedup, an N-instance deployment fires N webhook POSTs per message —
-- agents see duplicates, idempotency-naive backends double-process.
--
-- Pattern mirrors oli_webhook_deliveries: INSERT ... ON CONFLICT DO
-- NOTHING RETURNING id, then only POST if RETURNING produced a row.
-- The first instance to commit wins the dispatch.
--
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS "wallet_chat_webhook_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" text NOT NULL REFERENCES "oauth_clients"("client_id") ON DELETE CASCADE,
  "message_id" uuid NOT NULL REFERENCES "wallet_chat_messages"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "wallet_users"("id") ON DELETE CASCADE,
  -- 'pending' | 'delivered' | 'failed'
  "status" text NOT NULL DEFAULT 'pending',
  "http_status" integer,
  "attempt_count" integer NOT NULL DEFAULT 0,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "delivered_at" timestamp with time zone
);

-- Hard idempotency: at most one delivery row per (client, message).
-- The dispatcher's INSERT ... ON CONFLICT DO NOTHING + this index is the
-- guarantee. Without it, multi-instance bus fan-out N-tuples every send.
CREATE UNIQUE INDEX IF NOT EXISTS "wallet_chat_webhook_deliveries_client_msg_uq"
  ON "wallet_chat_webhook_deliveries" USING btree ("client_id", "message_id");

CREATE INDEX IF NOT EXISTS "wallet_chat_webhook_deliveries_user_idx"
  ON "wallet_chat_webhook_deliveries" USING btree ("user_id", "created_at");
