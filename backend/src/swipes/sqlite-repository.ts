import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  DIRECTIONS,
  type Direction,
  type Swipe,
  type SwipeCounts,
  type SwipeRepository,
  type SwipeRepositoryOptions,
} from "./repository.js";

export interface SqliteSwipeRepository extends SwipeRepository {
  /** Closes the database file. The repository cannot be used afterwards. */
  close(): void;
}

export type SqliteSwipeRepositoryOptions = SwipeRepositoryOptions;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS swipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    meme_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('like', 'nope')),
    swiped_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS swipes_by_user ON swipes (user_id);
  CREATE INDEX IF NOT EXISTS swipes_by_meme ON swipes (meme_id);
  CREATE INDEX IF NOT EXISTS swipes_by_time ON swipes (swiped_at);
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
  const moveNewMemes = db.prepare(
    "UPDATE swipes SET user_id = ? WHERE user_id = ? AND meme_id NOT IN (SELECT meme_id FROM swipes WHERE user_id = ?)",
  );
  const countByMeme = db.prepare(
    "SELECT COUNT(*) AS swipes, COALESCE(SUM(direction = 'like'), 0) AS likes FROM swipes WHERE meme_id = ?",
  );
  const countAllByMemeSince = db.prepare(
    "SELECT meme_id, COUNT(*) AS swipes, SUM(direction = 'like') AS likes FROM swipes WHERE swiped_at >= ? GROUP BY meme_id",
  );

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
    moveByUser: (fromUserId, toUserId) => {
      if (fromUserId === toUserId) return;
      // One transaction, so a failure cannot leave the swipes half moved.
      db.exec("BEGIN IMMEDIATE");
      try {
        moveNewMemes.run(toUserId, fromUserId, toUserId);
        deleteByUser.run(fromUserId);
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
    countByMeme: (memeId): SwipeCounts => {
      const row = countByMeme.get(memeId);
      return { likes: Number(row?.likes ?? 0), swipes: Number(row?.swipes ?? 0) };
    },
    countAllByMemeSince: (since) =>
      new Map(
        countAllByMemeSince
          .all(since)
          .map((row): [string, SwipeCounts] => [
            String(row.meme_id),
            { likes: Number(row.likes), swipes: Number(row.swipes) },
          ]),
      ),
    close: () => db.close(),
  };
}
