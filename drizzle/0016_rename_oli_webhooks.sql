-- Rename OLI webhook tables and indexes to drop the OLI prefix.
-- Tables and indexes only — column names and types unchanged.
--
-- Idempotent — safe to re-run because pg_class lookups guard each rename.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'oli_webhook_subscriptions') THEN
    ALTER TABLE "oli_webhook_subscriptions" RENAME TO "webhook_subscriptions";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'oli_webhook_deliveries') THEN
    ALTER TABLE "oli_webhook_deliveries" RENAME TO "webhook_deliveries";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'oli_webhook_subs_owner_idx') THEN
    ALTER INDEX "oli_webhook_subs_owner_idx" RENAME TO "webhook_subs_owner_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'oli_webhook_subs_status_idx') THEN
    ALTER INDEX "oli_webhook_subs_status_idx" RENAME TO "webhook_subs_status_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'oli_webhook_subs_recipient_idx') THEN
    ALTER INDEX "oli_webhook_subs_recipient_idx" RENAME TO "webhook_subs_recipient_idx";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'oli_webhook_deliveries_sub_event_uq') THEN
    ALTER INDEX "oli_webhook_deliveries_sub_event_uq" RENAME TO "webhook_deliveries_sub_event_uq";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'oli_webhook_deliveries_retry_ready_idx') THEN
    ALTER INDEX "oli_webhook_deliveries_retry_ready_idx" RENAME TO "webhook_deliveries_retry_ready_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'oli_webhook_deliveries_delivery_id_idx') THEN
    ALTER INDEX "oli_webhook_deliveries_delivery_id_idx" RENAME TO "webhook_deliveries_delivery_id_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'oli_webhook_deliveries_sub_status_idx') THEN
    ALTER INDEX "oli_webhook_deliveries_sub_status_idx" RENAME TO "webhook_deliveries_sub_status_idx";
  END IF;
END $$;
