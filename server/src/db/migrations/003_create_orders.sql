CREATE TYPE order_status AS ENUM (
  'pending', 'paid', 'fulfilled', 'cancelled'
);

CREATE TABLE orders (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id              UUID         NOT NULL REFERENCES users(id),
  status                   order_status NOT NULL DEFAULT 'pending',
  subtotal_cents           INTEGER      NOT NULL,
  fee_percent              NUMERIC(5,2) NOT NULL,
  platform_fee_cents       INTEGER      NOT NULL,
  total_cents              INTEGER      NOT NULL,
  payment_ref              TEXT,
  stripe_payment_intent_id TEXT,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  listing_id       UUID    NOT NULL REFERENCES listings(id),
  quantity         INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL
);

CREATE INDEX idx_orders_consumer_id ON orders (consumer_id);
CREATE INDEX idx_orders_status      ON orders (status);
CREATE INDEX idx_order_items_order  ON order_items (order_id);
