CREATE TYPE exchange_status AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE exchanges (
  id           UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_id UUID            NOT NULL REFERENCES users(id),
  listing_id   UUID            NOT NULL REFERENCES listings(id),
  offered_item TEXT            NOT NULL,
  message      TEXT,
  status       exchange_status NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exchanges_listing ON exchanges (listing_id);
