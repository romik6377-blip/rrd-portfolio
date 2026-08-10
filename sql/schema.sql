CREATE TABLE IF NOT EXISTS site_state (
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
