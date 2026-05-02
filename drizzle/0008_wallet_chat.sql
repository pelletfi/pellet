-- Wallet Chat substrate v1: in-wallet message thread between agent and user.
--
-- Single canonical thread per user. session_id (nullable) tags which agent
-- session posted, so future multi-thread UI can split by agent without a
-- migration. sender enum lives in app code: 'agent' | 'user' | 'system'.
-- kind enum also app-side: 'status' | 'question' | 'approval_request' |
-- 'reply' | 'report'.
--
-- intent_id is reserved for approval_request messages — it FKs to a future
-- spend-intent table (Phase 2 of the chat MVP). Nullable now; add the FK
-- in a later migration when that table exists.
--
-- Realtime: trigger fires pg_notify on insert so the bus (lib/realtime/bus.ts)
-- can fan out to SSE clients in real time. Channel name is 'wallet_chat'.
--
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS "wallet_chat_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "wallet_users"("id") ON DELETE CASCADE,
  "session_id" uuid REFERENCES "wallet_sessions"("id") ON DELETE SET NULL,
  "sender" text NOT NULL,
  "kind" text NOT NULL,
  "content" text NOT NULL,
  "intent_id" uuid,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "wallet_chat_user_ts_idx"
  ON "wallet_chat_messages" USING btree ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "wallet_chat_session_ts_idx"
  ON "wallet_chat_messages" USING btree ("session_id", "created_at")
  WHERE "session_id" IS NOT NULL;

-- Realtime bus trigger: fires NOTIFY on every wallet_chat_messages insert so
-- the SSE bus can pick it up and push to live clients.

CREATE OR REPLACE FUNCTION notify_wallet_chat_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('wallet_chat', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wallet_chat_notify ON wallet_chat_messages;
CREATE TRIGGER wallet_chat_notify
AFTER INSERT ON wallet_chat_messages
FOR EACH ROW EXECUTE FUNCTION notify_wallet_chat_insert();
