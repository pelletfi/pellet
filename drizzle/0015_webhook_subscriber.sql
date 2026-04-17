-- Track which Pellet Pro subscriber owns each webhook subscription so we can
-- scope list/delete operations to the caller (and so admin-created subs stay
-- unscoped with NULL).  Pre-existing rows keep NULL -> unscoped ownership.

ALTER TABLE webhook_subscriptions
  ADD COLUMN IF NOT EXISTS subscriber_key TEXT;

CREATE INDEX IF NOT EXISTS webhook_subscriptions_subscriber_key_idx
  ON webhook_subscriptions (subscriber_key);
