import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createInMemorySwipeRepository, type SwipeRepository } from "../src/swipes/repository.js";
import { createSqliteSwipeRepository } from "../src/swipes/sqlite-repository.js";

const tempDirs: string[] = [];

function tempDatabasePath(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "meme-tinder-"));
  tempDirs.push(dir);
  return path.join(dir, "nested", "swipes.db");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// Every SwipeRepository implementation must pass the same contract.
describe.each<[string, () => SwipeRepository]>([
  ["in-memory", createInMemorySwipeRepository],
  ["SQLite in memory", () => createSqliteSwipeRepository(":memory:")],
  ["SQLite file", () => createSqliteSwipeRepository(tempDatabasePath())],
])("%s swipe repository", (_name, createRepository) => {
  it("lists nothing for a user without swipes", () => {
    expect(createRepository().listByUser("u1")).toEqual([]);
  });

  it("lists a user's swipes in the order they were added", () => {
    const repository = createRepository();
    repository.add("u1", { memeId: "b", direction: "like" });
    repository.add("u1", { memeId: "a", direction: "nope" });

    expect(repository.listByUser("u1")).toEqual([
      { memeId: "b", direction: "like" },
      { memeId: "a", direction: "nope" },
    ]);
  });

  it("keeps swipes separate per user", () => {
    const repository = createRepository();
    repository.add("u1", { memeId: "a", direction: "like" });

    expect(repository.listByUser("u2")).toEqual([]);
  });

  it("clears only the given user's swipes", () => {
    const repository = createRepository();
    repository.add("u1", { memeId: "a", direction: "like" });
    repository.add("u2", { memeId: "a", direction: "nope" });

    repository.clearByUser("u1");
    repository.clearByUser("nobody");

    expect(repository.listByUser("u1")).toEqual([]);
    expect(repository.listByUser("u2")).toEqual([{ memeId: "a", direction: "nope" }]);
  });

  it("returns a copy that does not change the stored swipes", () => {
    const repository = createRepository();
    repository.add("u1", { memeId: "a", direction: "like" });

    repository.listByUser("u1").pop();

    expect(repository.listByUser("u1")).toHaveLength(1);
  });
});

describe("SQLite swipe repository file", () => {
  it("keeps swipes after the database is closed and opened again", () => {
    const file = tempDatabasePath();
    const first = createSqliteSwipeRepository(file);
    first.add("u1", { memeId: "a", direction: "like" });
    first.add("u1", { memeId: "b", direction: "nope" });
    first.close();

    const reopened = createSqliteSwipeRepository(file);

    expect(reopened.listByUser("u1")).toEqual([
      { memeId: "a", direction: "like" },
      { memeId: "b", direction: "nope" },
    ]);
    reopened.close();
  });

  it("keeps a reset after the database is opened again", () => {
    const file = tempDatabasePath();
    const first = createSqliteSwipeRepository(file);
    first.add("u1", { memeId: "a", direction: "like" });
    first.clearByUser("u1");
    first.close();

    const reopened = createSqliteSwipeRepository(file);

    expect(reopened.listByUser("u1")).toEqual([]);
    reopened.close();
  });
});
