-- Append-only history tables for endpoints that currently overwrite state.
-- Enables `?as_of=` time-travel queries. History populated going forward
-- from the time this migration runs; no backfill is possible.

CREATE TABLE IF NOT EXISTS risk_scores_history (
  id SERIAL PRIMARY KEY,
  stable TEXT NOT NULL,
  composite NUMERIC NOT NULL,
  components JSONB NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS risk_scores_history_stable_time_idx
  ON risk_scores_history (stable, computed_at DESC);

CREATE TABLE IF NOT EXISTS reserves_history (
  id SERIAL PRIMARY KEY,
  stable TEXT NOT NULL,
  reserve_type TEXT NOT NULL,
  backing_usd NUMERIC,
  attestation_source TEXT,
  verified_by TEXT,
  notes JSONB,
  attested_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS reserves_history_stable_time_idx
  ON reserves_history (stable, attested_at DESC);
