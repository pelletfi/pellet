-- Webhooks
CREATE TABLE IF NOT EXISTS "webhook_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"event_types" text[] NOT NULL,
	"stable_filter" text[],
	"active" text NOT NULL DEFAULT 'true',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_delivery_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text NOT NULL DEFAULT 'pending',
	"attempts" integer NOT NULL DEFAULT 0,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "webhook_deliveries_status_next_attempt_idx" ON "webhook_deliveries" ("status","next_attempt_at");

-- Risk scores
CREATE TABLE IF NOT EXISTS "risk_scores" (
	"stable" text PRIMARY KEY NOT NULL,
	"composite" numeric NOT NULL,
	"components" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Reserves
CREATE TABLE IF NOT EXISTS "reserves" (
	"stable" text NOT NULL,
	"reserve_type" text NOT NULL,
	"backing_usd" numeric,
	"attestation_source" text,
	"attested_at" timestamp with time zone,
	"verified_by" text,
	"notes" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reserves_stable_reserve_type_pk" PRIMARY KEY("stable","reserve_type")
);
