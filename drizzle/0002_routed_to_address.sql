-- T10: gateway attribution. Adds routed_to_address to agent_events so that
-- payments routed through the Tempo MPP Gateway can be attributed to the
-- underlying service provider (extracted from the Settlement event emitted
-- by the gateway's settlement contract 0x33b901018174ddabe4841042ab76ba85d4e24f25).
--
-- Idempotent — safe to re-run.

ALTER TABLE "agent_events" ADD COLUMN IF NOT EXISTS "routed_to_address" text;
CREATE INDEX IF NOT EXISTS "agent_events_routed_to_idx" ON "agent_events" USING btree ("routed_to_address");
