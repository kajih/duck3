import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface StoredMeme {
  id: string;
  caption: string;
  svg: string;
  seed: boolean;
}

export interface MemeRepository {
  list(): StoredMeme[];
  get(id: string): StoredMeme | undefined;
  add(meme: StoredMeme): boolean;
  close(): void;
}

export function createSqliteMemeRepository(filename: string): MemeRepository {
  if (filename !== ":memory:") mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS memes (
      id TEXT PRIMARY KEY, caption TEXT NOT NULL, svg TEXT NOT NULL, seed INTEGER NOT NULL
    );
  `);
  function fromRow(row: Record<string, unknown>): StoredMeme {
    return {
      id: String(row.id),
      caption: String(row.caption),
      svg: String(row.svg),
      seed: Boolean(row.seed),
    };
  }
  return {
    list: () => db.prepare("SELECT * FROM memes ORDER BY rowid").all().map(fromRow),
    get(id) {
      const row = db.prepare("SELECT * FROM memes WHERE id=?").get(id);
      return row ? fromRow(row) : undefined;
    },
    add: (meme) =>
      db
        .prepare("INSERT OR IGNORE INTO memes (id,caption,svg,seed) VALUES (?,?,?,?)")
        .run(meme.id, meme.caption, meme.svg, Number(meme.seed)).changes === 1,
    close: () => db.close(),
  };
}
