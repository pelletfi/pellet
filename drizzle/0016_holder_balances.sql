-- Per-holder balance state rebuilt incrementally from the events table.
-- Before this table, `holder-snapshot-builder` pulled every Transfer / Mint /
-- Burn event for every tracked stablecoin on every run (~100MB of JSONB per
-- cron tick) and re-summed balances in Node.  At 10-min cadence that burned
-- Neon's free network-transfer allowance in hours.
--
-- With this table, the cron reads only events since its last cursor and
-- applies signed deltas via UPSERT.  Snapshots are built by reading the top-N
-- rows from `holder_balances`, not by replaying history.
--
-- `balance` is NUMERIC (arbitrary precision) because TIP-20 amounts are
-- uint256 and can exceed bigint.  Negative values are possible transiently
-- during out-of-order cursor catch-up but the snapshot builder filters
-- `balance > 0` — an invariant we enforce by ingest being monotonic.

CREATE TABLE IF NOT EXISTS "holder_balances" (
  "stable" TEXT NOT NULL,
  "holder" TEXT NOT NULL,
  "balance" NUMERIC NOT NULL,
  PRIMARY KEY ("stable", "holder")
);

-- Primary query shape: "top N holders of a stable by balance DESC".  The
-- compound index (stable, balance DESC) answers that with an index-only
-- range scan.  No seq-scan of the full balances table per snapshot.
CREATE INDEX IF NOT EXISTS "holder_balances_stable_balance_idx"
  ON "holder_balances" ("stable", "balance" DESC);
