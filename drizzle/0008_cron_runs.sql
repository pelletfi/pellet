CREATE TABLE IF NOT EXISTS "cron_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"cron_name" text NOT NULL,
	"status" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"detail" jsonb,
	"error" text,
	"started_at" timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS "cron_runs_name_time_idx" ON "cron_runs" ("cron_name","started_at" DESC);
