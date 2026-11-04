import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ProfileRepository } from "./repository.js";

export interface SqliteProfileRepository extends ProfileRepository {
  /** Closes the database file. The repository cannot be used afterwards. */
  close(): void;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY,
    public_id TEXT NOT NULL UNIQUE,
    nickname TEXT NOT NULL,
    emoji TEXT NOT NULL
  );
`;

/**
 * Profiles stored in a SQLite file, so they survive restarts. It can share the file with the
 * swipe repository. Pass ":memory:" for a throwaway database.
 */
export function createSqliteProfileRepository(filename: string): SqliteProfileRepository {
  if (filename !== ":memory:") mkdirSync(path.dirname(filename), { recursive: true });

  const db = new DatabaseSync(filename);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(SCHEMA);

  const selectByUser = db.prepare("SELECT public_id, nickname, emoji FROM profiles WHERE user_id = ?");
  const upsert = db.prepare(`
    INSERT INTO profiles (user_id, public_id, nickname, emoji) VALUES (?, ?, ?, ?)
    ON CONFLICT (user_id) DO UPDATE SET nickname = excluded.nickname, emoji = excluded.emoji
  `);

  return {
    getByUser: (userId) => {
      const row = selectByUser.get(userId);
      if (!row) return undefined;
      return { id: String(row.public_id), nickname: String(row.nickname), emoji: String(row.emoji) };
    },
    save: (userId, profile) => {
      upsert.run(userId, profile.id, profile.nickname, profile.emoji);
    },
    close: () => db.close(),
  };
}
