PRAGMA foreign_keys = ON;

ALTER TABLE games ADD COLUMN slug TEXT;
ALTER TABLE games ADD COLUMN edit_token_hash TEXT;
ALTER TABLE games ADD COLUMN published_at TEXT;
ALTER TABLE games ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_games_slug ON games(slug) WHERE slug IS NOT NULL;
