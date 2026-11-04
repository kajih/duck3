import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DIRECTIONS, type Direction, type Swipe, type SwipeRepository } from "./repository.js";

export interface SqliteSwipeRepository extends SwipeRepository {
  /** Closes the database file. The repository cannot be used afterwards. */
  close(): void;
}

export interface SqliteSwipeRepositoryOptions {
  /** Clock for the stored swipe time, in milliseconds since the epoch. Defaults to Date.now. */
  now?: () => number;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS swipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    meme_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('like', 'nope')),
    swiped_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS swipes_by_user ON swipes (user_id);
`;

function toDirection(value: unknown): Direction {
  const direction = DIRECTIONS.find((d) => d === value);
  if (!direction) throw new Error(`Invalid direction in database: ${String(value)}`);
  return direction;
}

/**
 * Swipes stored in a SQLite file, so they survive restarts. Pass ":memory:" for a
 * throwaway database. The swipe time is stored too (`swiped_at`) for time-based stats.
 */
export function createSqliteSwipeRepository(
  filename: string,
  options: SqliteSwipeRepositoryOptions = {},
): SqliteSwipeRepository {
  const now = options.now ?? Date.now;
  if (filename !== ":memory:") mkdirSync(path.dirname(filename), { recursive: true });

  const db = new DatabaseSync(filename);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(SCHEMA);

  const selectByUser = db.prepare("SELECT meme_id, direction FROM swipes WHERE user_id = ? ORDER BY id");
  const insert = db.prepare("INSERT INTO swipes (user_id, meme_id, direction, swiped_at) VALUES (?, ?, ?, ?)");
  const deleteByUser = db.prepare("DELETE FROM swipes WHERE user_id = ?");

  return {
    listByUser: (userId) =>
      selectByUser.all(userId).map(
        (row): Swipe => ({ memeId: String(row.meme_id), direction: toDirection(row.direction) }),
      ),
    add: (userId, swipe) => {
      insert.run(userId, swipe.memeId, swipe.direction, now());
    },
    clearByUser: (userId) => {
      deleteByUser.run(userId);
    },
    close: () => db.close(),
  };
}
