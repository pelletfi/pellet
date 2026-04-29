ALTER TABLE "agent_events" ADD COLUMN "amount_wei" text;--> statement-breakpoint
ALTER TABLE "agent_events" ADD COLUMN "token_address" text;--> statement-breakpoint
ALTER TABLE "agent_events" ADD COLUMN "counterparty_address" text;--> statement-breakpoint
CREATE INDEX "agent_events_counterparty_idx" ON "agent_events" USING btree ("counterparty_address");