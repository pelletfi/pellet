-- Rolling peg aggregates — one row per (stable, window).

CREATE TABLE IF NOT EXISTS "peg_aggregates" (
	"stable" text NOT NULL,
	"window_label" text NOT NULL,
	"computed_at" timestamp with time zone NOT NULL,
	"sample_count" integer NOT NULL,
	"mean_price" numeric NOT NULL,
	"stddev_price" numeric NOT NULL,
	"min_price" numeric NOT NULL,
	"max_price" numeric NOT NULL,
	"max_deviation_bps" numeric NOT NULL,
	"seconds_outside_10bps" integer NOT NULL,
	"seconds_outside_50bps" integer NOT NULL,
	CONSTRAINT "peg_aggregates_stable_window_label_pk" PRIMARY KEY("stable","window_label")
);
