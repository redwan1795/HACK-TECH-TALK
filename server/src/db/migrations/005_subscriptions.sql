CREATE TYPE subscription_cadence AS ENUM ('weekly', 'biweekly', 'monthly');
CREATE TYPE subscription_status  AS ENUM ('active', 'paused', 'cancelled');

CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id      UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  cadence         subscription_cadence NOT NULL,
  status          subscription_status NOT NULL DEFAULT 'active',
  next_billing_at TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subs_consumer ON subscriptions(consumer_id);
CREATE INDEX idx_subs_status   ON subscriptions(status);
