-- Wallet chat per-agent routing.
--
-- v1 stored one canonical user thread and only tagged legacy Access Key
-- sessions. Durable BYOA agents live in wallet_agent_connections, so chat
-- messages now carry nullable connection_id/client_id fields. Existing rows
-- remain valid; new OAuth/MCP and wallet replies route through connection_id.

ALTER TABLE "wallet_chat_messages"
  ADD COLUMN IF NOT EXISTS "connection_id" uuid;

ALTER TABLE "wallet_chat_messages"
  ADD COLUMN IF NOT EXISTS "client_id" text;

DO $$
BEGIN
  ALTER TABLE "wallet_chat_messages"
    ADD CONSTRAINT "wallet_chat_messages_connection_id_wallet_agent_connections_id_fk"
    FOREIGN KEY ("connection_id")
    REFERENCES "wallet_agent_connections"("id")
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "wallet_chat_messages"
    ADD CONSTRAINT "wallet_chat_messages_client_id_oauth_clients_client_id_fk"
    FOREIGN KEY ("client_id")
    REFERENCES "oauth_clients"("client_id")
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "wallet_chat_connection_ts_idx"
  ON "wallet_chat_messages" USING btree ("connection_id", "created_at")
  WHERE "connection_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "wallet_chat_client_ts_idx"
  ON "wallet_chat_messages" USING btree ("user_id", "client_id", "created_at")
  WHERE "client_id" IS NOT NULL;

-- Best-effort backfill for legacy rows whose session_id was recorded in the
-- durable connection table. OAuth-only rows without a wallet session stay
-- unscoped, which is safer than guessing.
UPDATE "wallet_chat_messages" m
SET
  "connection_id" = cxn."id",
  "client_id" = cxn."client_id"
FROM "wallet_agent_connections" cxn
WHERE m."connection_id" IS NULL
  AND m."session_id" IS NOT NULL
  AND cxn."user_id" = m."user_id"
  AND cxn."last_session_id" = m."session_id"
  AND cxn."revoked_at" IS NULL;
