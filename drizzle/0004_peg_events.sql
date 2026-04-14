-- Peg-break events derived from peg_samples.

CREATE TABLE IF NOT EXISTS "peg_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"stable" text NOT NULL,
	"severity" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer,
	"max_deviation_bps" numeric NOT NULL,
	"started_block" bigint NOT NULL,
	"ended_block" bigint,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "peg_events_stable_time_idx" ON "peg_events" ("stable","started_at");

-- Unique constraint on (stable, started_at) so upserts by start time are idempotent.
ALTER TABLE "peg_events" ADD CONSTRAINT "peg_events_stable_started_at_unique" UNIQUE ("stable","started_at");
