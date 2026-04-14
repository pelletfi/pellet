CREATE TABLE IF NOT EXISTS "flow_anomalies" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_token" text NOT NULL,
	"to_token" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"observed_flow_usd" numeric NOT NULL,
	"baseline_mean_usd" numeric NOT NULL,
	"baseline_stddev_usd" numeric NOT NULL,
	"z_score" numeric NOT NULL,
	"tx_count" integer NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "flow_anomalies_edge_time_idx" ON "flow_anomalies" ("from_token","to_token","window_start");
CREATE INDEX IF NOT EXISTS "flow_anomalies_time_idx" ON "flow_anomalies" ("window_start");

ALTER TABLE "flow_anomalies" ADD CONSTRAINT "flow_anomalies_edge_window_unique" UNIQUE ("from_token","to_token","window_start");
