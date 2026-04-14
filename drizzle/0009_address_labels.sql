CREATE TABLE IF NOT EXISTS "address_labels" (
	"address" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"category" text NOT NULL,
	"source" text NOT NULL,
	"verified" text NOT NULL DEFAULT 'true',
	"notes" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "address_labels_category_idx" ON "address_labels" ("category");
