-- Reward tracking — Tempo TIP-20 reward precompile events.
-- Decoded from `events` table by lib/ingest/reward-decoder.ts.

-- RewardDistributed(indexed funder, uint256 amount): one row per funding event.
-- PK on (tx_hash, log_index) for idempotency against the decoder re-scanning.
CREATE TABLE IF NOT EXISTS reward_distributions (
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  stable TEXT NOT NULL,
  funder TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  block_number BIGINT NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS reward_distributions_stable_time_idx
  ON reward_distributions (stable, block_timestamp DESC);
CREATE INDEX IF NOT EXISTS reward_distributions_funder_idx
  ON reward_distributions (funder);

-- RewardRecipientSet(indexed holder, indexed recipient): current opt-in state.
-- One row per (stable, holder). Updated in place via UPSERT when a holder
-- changes their reward recipient (or opts out by setting recipient = 0x0).
CREATE TABLE IF NOT EXISTS reward_recipients (
  stable TEXT NOT NULL,
  holder TEXT NOT NULL,
  recipient TEXT NOT NULL,
  set_at TIMESTAMPTZ NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  block_number BIGINT NOT NULL,
  PRIMARY KEY (stable, holder)
);
CREATE INDEX IF NOT EXISTS reward_recipients_stable_idx
  ON reward_recipients (stable);

-- Cursor for reward decoder — tracks highest (block, logIndex) already decoded.
-- Decoder pulls events in order after (last_block, last_log_index).
INSERT INTO ingestion_cursors (contract, last_block, updated_at)
VALUES ('__reward_decoder__', 0, NOW())
ON CONFLICT (contract) DO NOTHING;
