PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS share_games (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  edit_token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS share_questions (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  asset_key TEXT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES share_games(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_share_questions_game ON share_questions(game_id, position);
CREATE INDEX IF NOT EXISTS idx_share_games_updated ON share_games(updated_at);
