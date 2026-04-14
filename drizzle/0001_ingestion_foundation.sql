-- Ingestion foundation: events, peg_samples, ingestion_cursors
-- Safe to run against existing database; uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "events" (
	"tx_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp with time zone NOT NULL,
	"contract" text NOT NULL,
	"event_type" text NOT NULL,
	"args" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_tx_hash_log_index_pk" PRIMARY KEY("tx_hash","log_index")
);

CREATE INDEX IF NOT EXISTS "events_contract_block_idx" ON "events" ("contract","block_number");
CREATE INDEX IF NOT EXISTS "events_type_block_idx" ON "events" ("event_type","block_number");

CREATE TABLE IF NOT EXISTS "peg_samples" (
	"id" serial PRIMARY KEY NOT NULL,
	"stable" text NOT NULL,
	"block_number" bigint NOT NULL,
	"sampled_at" timestamp with time zone NOT NULL,
	"price_vs_pathusd" numeric NOT NULL,
	"spread_bps" numeric NOT NULL
);

CREATE INDEX IF NOT EXISTS "peg_samples_stable_time_idx" ON "peg_samples" ("stable","sampled_at");

CREATE TABLE IF NOT EXISTS "ingestion_cursors" (
	"contract" text PRIMARY KEY NOT NULL,
	"last_block" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
