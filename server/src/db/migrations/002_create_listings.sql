CREATE TYPE listing_category AS ENUM (
  'vegetable', 'fruit', 'flower', 'egg', 'other'
);

CREATE TABLE listings (
  id                 UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id        UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title              TEXT             NOT NULL,
  description        TEXT,
  category           listing_category NOT NULL DEFAULT 'other',
  price_cents        INTEGER,
  quantity_available INTEGER          NOT NULL DEFAULT 0,
  exchange_for       TEXT,
  location_zip       TEXT             NOT NULL,
  location_lat       DOUBLE PRECISION,
  location_lng       DOUBLE PRECISION,
  images             TEXT[]           NOT NULL DEFAULT '{}',
  is_available       BOOLEAN          NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_listings_producer_id  ON listings (producer_id);
CREATE INDEX idx_listings_location_zip ON listings (location_zip);
CREATE INDEX idx_listings_category     ON listings (category);
CREATE INDEX idx_listings_is_available ON listings (is_available);
