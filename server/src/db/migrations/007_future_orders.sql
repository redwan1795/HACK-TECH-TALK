CREATE TYPE future_order_status AS ENUM (
  'open', 'matched', 'fulfilled', 'expired', 'cancelled'
);

CREATE TABLE future_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_query       TEXT NOT NULL,
  category            listing_category,
  quantity_needed     INTEGER NOT NULL DEFAULT 1,
  proximity_miles     INTEGER NOT NULL DEFAULT 25,
  expires_at          TIMESTAMPTZ NOT NULL,
  status              future_order_status NOT NULL DEFAULT 'open',
  matched_listing_id  UUID REFERENCES listings(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fo_consumer ON future_orders(consumer_id);
CREATE INDEX idx_fo_status   ON future_orders(status);
CREATE INDEX idx_fo_expires  ON future_orders(expires_at);
