CREATE TABLE platform_config (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_config (key, value) VALUES
  ('fee_percent',       '7'),
  ('max_radius_miles',  '100'),
  ('ai_search_enabled', 'true');
