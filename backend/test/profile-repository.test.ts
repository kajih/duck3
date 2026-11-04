import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createInMemoryProfileRepository, type ProfileRepository } from "../src/profiles/repository.js";
import {
  createSqliteProfileRepository,
  type SqliteProfileRepository,
} from "../src/profiles/sqlite-repository.js";
import { createSqliteSwipeRepository } from "../src/swipes/sqlite-repository.js";

const tempDirs: string[] = [];
const openDatabases: { close: () => void }[] = [];

/** Closed by afterEach even when a test fails, so Windows can remove the temporary files. Closing it earlier is fine. */
function trackedSqliteRepository(filename: string): SqliteProfileRepository {
  const repository = createSqliteProfileRepository(filename);
  let open = true;
  const tracked: SqliteProfileRepository = {
    ...repository,
    close: () => {
      if (!open) return;
      open = false;
      repository.close();
    },
  };
  openDatabases.push(tracked);
  return tracked;
}

function tempDatabasePath(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "meme-tinder-profiles-"));
  tempDirs.push(dir);
  return path.join(dir, "nested", "app.db");
}

afterEach(() => {
  for (const database of openDatabases.splice(0)) database.close();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const otter = { id: "p1", nickname: "Giggling Otter", emoji: "🦦" };

// Every ProfileRepository implementation must pass the same contract.
describe.each<[string, () => ProfileRepository]>([
  ["in-memory", createInMemoryProfileRepository],
  ["SQLite in memory", () => trackedSqliteRepository(":memory:")],
  ["SQLite file", () => trackedSqliteRepository(tempDatabasePath())],
])("%s profile repository", (_name, createRepository) => {
  it("has no profile for an unknown user", () => {
    expect(createRepository().getByUser("u1")).toBeUndefined();
  });

  it("returns a saved profile by user id", () => {
    const repository = createRepository();
    repository.save("u1", otter);

    expect(repository.getByUser("u1")).toEqual(otter);
    expect(repository.getByUser("u2")).toBeUndefined();
  });

  it("replaces nickname and emoji when saved again", () => {
    const repository = createRepository();
    repository.save("u1", otter);
    repository.save("u1", { ...otter, nickname: "Turbo Frog", emoji: "🐸" });

    expect(repository.getByUser("u1")).toEqual({ id: "p1", nickname: "Turbo Frog", emoji: "🐸" });
  });

  it("returns a copy that does not change the stored profile", () => {
    const repository = createRepository();
    repository.save("u1", otter);

    const copy = repository.getByUser("u1");
    if (copy) copy.nickname = "Changed";

    expect(repository.getByUser("u1")).toEqual(otter);
  });
});

describe("SQLite profile repository file", () => {
  it("keeps profiles after the database is closed and opened again", () => {
    const file = tempDatabasePath();
    const first = trackedSqliteRepository(file);
    first.save("u1", otter);
    first.close();

    const reopened = trackedSqliteRepository(file);

    expect(reopened.getByUser("u1")).toEqual(otter);
    reopened.close();
  });

  it("shares a database file with the swipe repository", () => {
    const file = tempDatabasePath();
    const swipes = createSqliteSwipeRepository(file);
    openDatabases.push(swipes);
    const profiles = trackedSqliteRepository(file);

    swipes.add("u1", { memeId: "a", direction: "like" });
    profiles.save("u1", otter);

    expect(swipes.listByUser("u1")).toEqual([{ memeId: "a", direction: "like" }]);
    expect(profiles.getByUser("u1")).toEqual(otter);
  });
});
