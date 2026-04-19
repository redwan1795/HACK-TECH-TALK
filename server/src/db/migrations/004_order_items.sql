CREATE TABLE order_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  listing_id        UUID NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  quantity          INTEGER NOT NULL,
  unit_price_cents  INTEGER NOT NULL
);

CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_order_items_listing ON order_items(listing_id);
