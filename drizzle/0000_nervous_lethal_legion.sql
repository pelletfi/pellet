CREATE TABLE "address_labels" (
	"address" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"category" text NOT NULL,
	"source" text NOT NULL,
	"notes" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"tx_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"targets" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_block" bigint NOT NULL,
	"methodology_version" text NOT NULL,
	"matched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"source" text NOT NULL,
	"wallets" text[] DEFAULT '{}' NOT NULL,
	"bio" text,
	"links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cron_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"cron_name" text NOT NULL,
	"status" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"detail" jsonb,
	"error" text,
	"started_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
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
--> statement-breakpoint
CREATE TABLE "ingestion_cursors" (
	"contract" text PRIMARY KEY NOT NULL,
	"last_block" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "address_labels_category_idx" ON "address_labels" USING btree ("category");--> statement-breakpoint
CREATE INDEX "agent_events_ts_idx" ON "agent_events" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "agent_events_agent_ts_idx" ON "agent_events" USING btree ("agent_id","ts");--> statement-breakpoint
CREATE INDEX "agent_events_event_ref_idx" ON "agent_events" USING btree ("tx_hash","log_index");--> statement-breakpoint
CREATE INDEX "cron_runs_name_started_idx" ON "cron_runs" USING btree ("cron_name","started_at");--> statement-breakpoint
CREATE INDEX "events_contract_block_idx" ON "events" USING btree ("contract","block_number");--> statement-breakpoint
CREATE INDEX "events_block_timestamp_idx" ON "events" USING btree ("block_timestamp");