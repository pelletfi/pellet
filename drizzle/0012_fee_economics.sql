-- Fee-token economics tracking — Tempo fee manager precompile events.
-- Decoded from `events` table by lib/ingest/fee-decoder.ts.

-- FeesDistributed(indexed validator, indexed token, uint256 amount):
-- one row per distribution event. PK idempotent against decoder re-runs.
CREATE TABLE IF NOT EXISTS fee_distributions (
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  validator TEXT NOT NULL,
  token TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  block_number BIGINT NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS fee_distributions_token_time_idx
  ON fee_distributions (token, block_timestamp DESC);
CREATE INDEX IF NOT EXISTS fee_distributions_validator_idx
  ON fee_distributions (validator);

-- UserTokenSet(indexed user, indexed token): current fee-token election
-- per user. One row per user; latest election replaces prior.
-- token = 0x0 means opted-out (revert to default).
CREATE TABLE IF NOT EXISTS fee_token_users (
  "user" TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  set_at TIMESTAMPTZ NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  block_number BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS fee_token_users_token_idx ON fee_token_users (token);

-- ValidatorTokenSet(indexed validator, indexed token): same shape for validators.
CREATE TABLE IF NOT EXISTS fee_token_validators (
  validator TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  set_at TIMESTAMPTZ NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  block_number BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS fee_token_validators_token_idx ON fee_token_validators (token);

-- Cursor for the fee decoder.
INSERT INTO ingestion_cursors (contract, last_block, updated_at)
VALUES ('__fee_decoder__', 0, NOW())
ON CONFLICT (contract) DO NOTHING;
