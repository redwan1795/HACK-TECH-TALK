CREATE TYPE subscription_cadence AS ENUM ('weekly', 'biweekly', 'monthly');
CREATE TYPE subscription_status  AS ENUM ('active', 'paused', 'cancelled');

CREATE TABLE subscriptions (
  id              UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id     UUID                 NOT NULL REFERENCES users(id),
  listing_id      UUID                 NOT NULL REFERENCES listings(id),
  cadence         subscription_cadence NOT NULL,
  status          subscription_status  NOT NULL DEFAULT 'active',
  stripe_sub_id   TEXT,
  next_billing_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_consumer ON subscriptions (consumer_id);
