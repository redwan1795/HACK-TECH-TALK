CREATE TYPE exchange_status AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE exchanges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id    UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  offered_item  TEXT NOT NULL,
  status        exchange_status NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exchanges_listing ON exchanges(listing_id);
CREATE INDEX idx_exchanges_status  ON exchanges(status);
