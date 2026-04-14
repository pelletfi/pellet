-- Pellet Pro subscribers. One row per Stripe Customer.
-- api_key is the opaque bearer token the customer uses for auth.
CREATE TABLE IF NOT EXISTS pellet_pro_subscribers (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  api_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'cancelled' | 'past_due'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ
);

-- Fast lookup by api_key for request authentication.
CREATE INDEX IF NOT EXISTS pellet_pro_subscribers_api_key_idx
  ON pellet_pro_subscribers (api_key);
