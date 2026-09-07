PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS session_rounds (
  session_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  hint_used INTEGER NOT NULL DEFAULT 0 CHECK (hint_used IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'playing' CHECK (status IN ('playing', 'correct', 'revealed')),
  score INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, round_id),
  FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (round_id) REFERENCES game_rounds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS session_opened_tiles (
  session_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  tile_index INTEGER NOT NULL CHECK (tile_index >= 0),
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id, round_id, tile_index),
  FOREIGN KEY (session_id, round_id) REFERENCES session_rounds(session_id, round_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_rounds_session ON session_rounds(session_id);
CREATE INDEX IF NOT EXISTS idx_opened_tiles_session_round ON session_opened_tiles(session_id, round_id);
