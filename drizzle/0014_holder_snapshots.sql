-- Holder snapshots — cached per-token holder reconstruction computed by the
-- `holder-snapshot` background cron.  Hot tokens (USDC.e, pathUSD, etc.) have
-- too many Transfer events to enumerate within the briefing endpoint's 45s
-- wall-time budget, so live enumeration returns coverage:"unavailable" or
-- highly-partial coverage.  This table lets those request-time callers serve
-- a complete snapshot while the cron does the heavy enumeration out-of-band
-- with a generous (~4 min) budget.
--
-- One row per tracked stablecoin; UPSERT-on-stable each run.

CREATE TABLE IF NOT EXISTS "holder_snapshots" (
  "stable" TEXT PRIMARY KEY,
  "total_holders" INTEGER NOT NULL,
  "top5_pct" NUMERIC NOT NULL,
  "top10_pct" NUMERIC NOT NULL,
  "top20_pct" NUMERIC NOT NULL,
  "creator_address" TEXT,
  "creator_hold_pct" NUMERIC,
  "top_holders" JSONB NOT NULL,
  "coverage" TEXT NOT NULL,
  "coverage_note" TEXT,
  "as_of_block" BIGINT,
  "computed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "holder_snapshots_computed_at_idx"
  ON "holder_snapshots" ("computed_at");
