CREATE TABLE IF NOT EXISTS "health_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"check_type" text NOT NULL,
	"status" text NOT NULL,
	"detail" jsonb NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "health_checks_type_time_idx" ON "health_checks" ("check_type","checked_at" DESC);
