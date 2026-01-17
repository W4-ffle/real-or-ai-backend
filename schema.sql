CREATE TABLE IF NOT EXISTS puzzles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  puzzle_date TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS puzzle_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  puzzle_id INTEGER NOT NULL,
  round_index INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  is_real INTEGER NOT NULL CHECK (is_real IN (0,1)),
  FOREIGN KEY (puzzle_id) REFERENCES puzzles(id)
);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  puzzle_date TEXT NOT NULL,
  user_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  total_rounds INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(puzzle_date, user_id)
);

CREATE TABLE IF NOT EXISTS attempt_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL,
  round_index INTEGER NOT NULL,
  chosen_image_url TEXT NOT NULL,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0,1)),
  FOREIGN KEY (attempt_id) REFERENCES attempts(id)
);
