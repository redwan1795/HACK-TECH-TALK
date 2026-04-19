CREATE TYPE order_status AS ENUM (
  'pending', 'paid', 'fulfilled', 'cancelled'
);

CREATE TABLE orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status              order_status NOT NULL DEFAULT 'pending',
  subtotal_cents      INTEGER NOT NULL,
  platform_fee_cents  INTEGER NOT NULL,
  total_cents         INTEGER NOT NULL,
  payment_ref         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_consumer ON orders(consumer_id);
CREATE INDEX idx_orders_status   ON orders(status);
