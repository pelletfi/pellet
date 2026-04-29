-- T10.5: Pattern B fingerprint capture. The user→gateway calldata
-- (selector 0x95777d59) carries a bytes32 ref whose bytes 5-14 are
-- a stable 10-byte service fingerprint assigned by Tempo. Capture
-- it so attribution covers ~100% of gateway txs (by group) even when
-- the underlying provider can't be named yet.
--
-- Idempotent — safe to re-run.

ALTER TABLE "agent_events" ADD COLUMN IF NOT EXISTS "routed_fingerprint" text;
CREATE INDEX IF NOT EXISTS "agent_events_routed_fp_idx" ON "agent_events" USING btree ("routed_fingerprint");
