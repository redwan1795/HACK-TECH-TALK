CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM (
  'producer_home',
  'producer_farmer',
  'consumer',
  'broker',
  'mentor',
  'operator'
);

CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  role           user_role NOT NULL DEFAULT 'consumer',
  display_name   TEXT,
  location_zip   TEXT,
  location_lat   DOUBLE PRECISION,
  location_lng   DOUBLE PRECISION,
  licensed       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_zip  ON users(location_zip);
