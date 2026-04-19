CREATE TYPE future_order_status AS ENUM ('open', 'matched', 'expired', 'cancelled');

CREATE TABLE future_orders (
  id                 UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id        UUID                NOT NULL REFERENCES users(id),
  product_query      TEXT                NOT NULL,
  product_keyword    TEXT                NOT NULL,
  category           listing_category,
  quantity_needed    NUMERIC(10,2)       NOT NULL,
  unit               TEXT                NOT NULL DEFAULT 'unit',
  max_price_cents    INTEGER,
  proximity_miles    INTEGER             NOT NULL DEFAULT 25,
  zip                TEXT                NOT NULL,
  expires_at         TIMESTAMPTZ         NOT NULL,
  status             future_order_status NOT NULL DEFAULT 'open',
  matched_listing_id UUID                REFERENCES listings(id),
  created_at         TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_future_orders_status     ON future_orders (status);
CREATE INDEX idx_future_orders_consumer   ON future_orders (consumer_id);
CREATE INDEX idx_future_orders_expires_at ON future_orders (expires_at);
CREATE INDEX idx_future_orders_keyword    ON future_orders
  USING gin (to_tsvector('english', product_keyword));
