import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createInMemorySwipeRepository,
  type SwipeRepository,
  type SwipeRepositoryOptions,
} from "../src/swipes/repository.js";
import { createSqliteSwipeRepository, type SqliteSwipeRepository } from "../src/swipes/sqlite-repository.js";

const tempDirs: string[] = [];
const openRepositories: { close: () => void }[] = [];

/**
 * A SQLite repository that afterEach closes even when a test fails, so Windows can remove the
 * temporary database files. Closing it in the test as well is fine.
 */
function trackedSqliteRepository(filename: string, options?: SwipeRepositoryOptions): SqliteSwipeRepository {
  const repository = createSqliteSwipeRepository(filename, options);
  let open = true;
  const tracked: SqliteSwipeRepository = {
    ...repository,
    close: () => {
      if (!open) return;
      open = false;
      repository.close();
    },
  };
  openRepositories.push(tracked);
  return tracked;
}

function tempDatabasePath(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "meme-tinder-"));
  tempDirs.push(dir);
  return path.join(dir, "nested", "swipes.db");
}

afterEach(() => {
  for (const repository of openRepositories.splice(0)) repository.close();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// Every SwipeRepository implementation must pass the same contract.
describe.each<[string, (options?: SwipeRepositoryOptions) => SwipeRepository]>([
  ["in-memory", (options) => createInMemorySwipeRepository(options)],
  ["SQLite in memory", (options) => trackedSqliteRepository(":memory:", options)],
  ["SQLite file", (options) => trackedSqliteRepository(tempDatabasePath(), options)],
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

  it("counts no swipes for a meme nobody has swiped", () => {
    expect(createRepository().countByMeme("a")).toEqual({ likes: 0, swipes: 0 });
  });

  it("counts likes and swipes on a meme across all users", () => {
    const repository = createRepository();
    repository.add("u1", { memeId: "a", direction: "like" });
    repository.add("u2", { memeId: "a", direction: "nope" });
    repository.add("u3", { memeId: "a", direction: "like" });
    repository.add("u1", { memeId: "b", direction: "like" });

    expect(repository.countByMeme("a")).toEqual({ likes: 2, swipes: 3 });
    expect(repository.countByMeme("b")).toEqual({ likes: 1, swipes: 1 });
  });

  it("stops counting a user's swipes after they are cleared", () => {
    const repository = createRepository();
    repository.add("u1", { memeId: "a", direction: "like" });
    repository.add("u2", { memeId: "a", direction: "nope" });

    repository.clearByUser("u1");

    expect(repository.countByMeme("a")).toEqual({ likes: 0, swipes: 1 });
  });

  describe("countAllByMemeSince", () => {
    // A controlled clock: each swipe is stored at the current value of `time`.
    function timedRepository() {
      let time = 1_000;
      const repository = createRepository({ now: () => time });
      return { repository, setTime: (value: number) => (time = value) };
    }

    it("counts nothing when nobody has swiped", () => {
      expect(createRepository().countAllByMemeSince(0)).toEqual(new Map());
    });

    it("counts likes and swipes per meme across all users", () => {
      const { repository } = timedRepository();
      repository.add("u1", { memeId: "a", direction: "like" });
      repository.add("u2", { memeId: "a", direction: "nope" });
      repository.add("u2", { memeId: "b", direction: "like" });

      expect(repository.countAllByMemeSince(0)).toEqual(
        new Map([
          ["a", { likes: 1, swipes: 2 }],
          ["b", { likes: 1, swipes: 1 }],
        ]),
      );
    });

    it("counts only swipes made at or after the given time", () => {
      const { repository, setTime } = timedRepository();
      setTime(1_000);
      repository.add("u1", { memeId: "a", direction: "like" });
      repository.add("u1", { memeId: "b", direction: "like" });
      setTime(2_000);
      repository.add("u2", { memeId: "a", direction: "nope" });

      expect(repository.countAllByMemeSince(2_000)).toEqual(new Map([["a", { likes: 0, swipes: 1 }]]));
      expect(repository.countAllByMemeSince(2_001)).toEqual(new Map());
    });

    it("stops counting a user's swipes after they are cleared", () => {
      const { repository } = timedRepository();
      repository.add("u1", { memeId: "a", direction: "like" });
      repository.add("u2", { memeId: "a", direction: "like" });

      repository.clearByUser("u1");

      expect(repository.countAllByMemeSince(0)).toEqual(new Map([["a", { likes: 1, swipes: 1 }]]));
    });
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
    const first = trackedSqliteRepository(file);
    first.add("u1", { memeId: "a", direction: "like" });
    first.add("u1", { memeId: "b", direction: "nope" });
    first.close();

    const reopened = trackedSqliteRepository(file);

    expect(reopened.listByUser("u1")).toEqual([
      { memeId: "a", direction: "like" },
      { memeId: "b", direction: "nope" },
    ]);
    reopened.close();
  });

  it("keeps a reset after the database is opened again", () => {
    const file = tempDatabasePath();
    const first = trackedSqliteRepository(file);
    first.add("u1", { memeId: "a", direction: "like" });
    first.clearByUser("u1");
    first.close();

    const reopened = trackedSqliteRepository(file);

    expect(reopened.listByUser("u1")).toEqual([]);
    reopened.close();
  });
});
