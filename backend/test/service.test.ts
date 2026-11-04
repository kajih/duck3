import { describe, expect, it } from "vitest";
import { createMemeCatalog } from "../src/memes/catalog.js";
import { createInMemorySwipeRepository } from "../src/swipes/repository.js";
import {
  createSwipeService,
  MIN_SWIPES_FOR_PERCENT,
  MIN_SWIPES_FOR_TRENDING_WINDOW,
  TRENDING_LIMIT,
  TRENDING_WINDOW_HOURS,
  UnknownMemeError,
} from "../src/swipes/service.js";

function setup() {
  const catalog = createMemeCatalog([
    { id: "a", caption: "A", file: "a.svg" },
    { id: "b", caption: "B", file: "b.svg" },
  ]);
  return createSwipeService(catalog, createInMemorySwipeRepository());
}

describe("swipe service", () => {
  it("returns the first meme to a user who has not swiped", () => {
    expect(setup().getNextMeme("u1")?.id).toBe("a");
  });

  it("skips memes the user has liked or noped", () => {
    const service = setup();
    service.recordSwipe("u1", "a", "like");
    expect(service.getNextMeme("u1")?.id).toBe("b");
    service.recordSwipe("u1", "b", "nope");
    expect(service.getNextMeme("u1")).toBeNull();
  });

  it("returns the recorded swipe", () => {
    expect(setup().recordSwipe("u1", "a", "like")).toEqual({ memeId: "a", direction: "like" });
  });

  it("keeps the first swipe when the same meme is swiped again", () => {
    const service = setup();
    service.recordSwipe("u1", "a", "like");

    expect(service.recordSwipe("u1", "a", "nope")).toEqual({ memeId: "a", direction: "like" });
    expect(service.getNextMeme("u1")?.id).toBe("b");
  });

  it("keeps swipe history separate per user", () => {
    const service = setup();
    service.recordSwipe("u1", "a", "like");
    expect(service.getNextMeme("u2")?.id).toBe("a");
  });

  it("makes previously swiped memes available again after a reset", () => {
    const service = setup();
    service.recordSwipe("u1", "a", "like");
    service.recordSwipe("u1", "b", "nope");
    expect(service.getNextMeme("u1")).toBeNull();

    service.resetSwipes("u1");

    expect(service.getNextMeme("u1")?.id).toBe("a");
  });

  it("clears likes and nopes on reset", () => {
    const service = setup();
    service.recordSwipe("u1", "a", "like");
    service.recordSwipe("u1", "b", "nope");

    service.resetSwipes("u1");

    // A fresh swipe is stored with its new direction, so nothing from before survived.
    expect(service.recordSwipe("u1", "a", "nope")).toEqual({ memeId: "a", direction: "nope" });
    expect(service.recordSwipe("u1", "b", "like")).toEqual({ memeId: "b", direction: "like" });
  });

  it("only resets the given user", () => {
    const service = setup();
    service.recordSwipe("u1", "a", "like");
    service.recordSwipe("u2", "a", "like");

    service.resetSwipes("u1");

    expect(service.getNextMeme("u1")?.id).toBe("a");
    expect(service.getNextMeme("u2")?.id).toBe("b");
  });

  it("does nothing harmful when resetting a user with no swipes", () => {
    const service = setup();

    expect(() => service.resetSwipes("u1")).not.toThrow();
    expect(() => service.resetSwipes("u1")).not.toThrow();
    expect(service.getNextMeme("u1")?.id).toBe("a");
  });

  it("rejects an unknown meme id", () => {
    expect(() => setup().recordSwipe("u1", "nope-such-meme", "like")).toThrow(UnknownMemeError);
  });

  describe("listLikedMemes", () => {
    function setupWithThree() {
      const catalog = createMemeCatalog([
        { id: "a", caption: "A", file: "a.svg" },
        { id: "b", caption: "B", file: "b.svg" },
        { id: "c", caption: "C", file: "c.svg" },
      ]);
      return createSwipeService(catalog, createInMemorySwipeRepository());
    }
    const ids = (memes: { id: string }[]) => memes.map((meme) => meme.id);

    it("returns an empty list for a user with no swipes", () => {
      expect(setupWithThree().listLikedMemes("u1")).toEqual([]);
    });

    it("returns only liked memes, not nopes", () => {
      const service = setupWithThree();
      service.recordSwipe("u1", "a", "nope");
      service.recordSwipe("u1", "b", "like");

      expect(ids(service.listLikedMemes("u1"))).toEqual(["b"]);
    });

    it("returns full memes in a consistent order regardless of swipe order", () => {
      const service = setupWithThree();
      service.recordSwipe("u1", "c", "like");
      service.recordSwipe("u1", "a", "like");

      const likes = service.listLikedMemes("u1");

      expect(ids(likes)).toEqual(["a", "c"]);
      expect(likes[0]).toEqual({
        id: "a",
        caption: "A",
        imageUrl: expect.stringMatching(/a\.svg$/),
        stats: { likes: 1, swipes: 1, likePercent: null },
      });
      expect(service.listLikedMemes("u1")).toEqual(likes);
    });

    it("keeps likes separate per user", () => {
      const service = setupWithThree();
      service.recordSwipe("u1", "a", "like");
      service.recordSwipe("u2", "b", "like");

      expect(ids(service.listLikedMemes("u1"))).toEqual(["a"]);
      expect(ids(service.listLikedMemes("u2"))).toEqual(["b"]);
    });

    it("keeps the first swipe when a liked meme is swiped as nope again", () => {
      const service = setupWithThree();
      service.recordSwipe("u1", "a", "like");
      service.recordSwipe("u1", "a", "nope");

      expect(ids(service.listLikedMemes("u1"))).toEqual(["a"]);
    });

    it("is empty again after a reset", () => {
      const service = setupWithThree();
      service.recordSwipe("u1", "a", "like");

      service.resetSwipes("u1");

      expect(service.listLikedMemes("u1")).toEqual([]);
    });
  });

  describe("meme stats", () => {
    // Each user swipes meme "a"; the user "viewer" has not swiped, so "a" is their next meme.
    function swipeA(service: ReturnType<typeof setup>, directions: ("like" | "nope")[]) {
      directions.forEach((direction, i) => service.recordSwipe(`u${i}`, "a", direction));
    }
    const statsOfNext = (service: ReturnType<typeof setup>) => service.getNextMeme("viewer")?.stats;

    it("has no percentage for a meme nobody has swiped", () => {
      expect(statsOfNext(setup())).toEqual({ likes: 0, swipes: 0, likePercent: null });
    });

    it("has no percentage below the minimum number of swipes", () => {
      const service = setup();
      swipeA(service, Array(MIN_SWIPES_FOR_PERCENT - 1).fill("like"));

      expect(statsOfNext(service)).toEqual({ likes: MIN_SWIPES_FOR_PERCENT - 1, swipes: MIN_SWIPES_FOR_PERCENT - 1, likePercent: null });
    });

    it("shows the share of likes across all users from the minimum number of swipes", () => {
      const service = setup();
      swipeA(service, ["like", "like", "like", "like", "nope"]);

      expect(statsOfNext(service)).toEqual({ likes: 4, swipes: 5, likePercent: 80 });
    });

    it("rounds the percentage to a whole number", () => {
      const service = setup();
      swipeA(service, ["like", "like", "like", "like", "nope", "nope"]);

      expect(statsOfNext(service)?.likePercent).toBe(67);
    });

    it("stops counting a user's swipes after that user resets", () => {
      const service = setup();
      swipeA(service, ["like", "like", "like", "nope", "nope", "nope"]);
      expect(statsOfNext(service)?.likePercent).toBe(50);

      service.resetSwipes("u3");

      expect(statsOfNext(service)).toEqual({ likes: 3, swipes: 5, likePercent: 60 });
    });

    it("does not count a repeated swipe twice", () => {
      const service = setup();
      service.recordSwipe("u1", "a", "like");
      service.recordSwipe("u1", "a", "nope");

      expect(statsOfNext(service)).toEqual({ likes: 1, swipes: 1, likePercent: null });
    });
  });

  describe("listTrending", () => {
    const HOUR = 60 * 60 * 1000;
    const NOW = 100 * 24 * HOUR;

    // The repository stamps swipes and the service measures the window with the same controlled clock.
    function trendingSetup(memeIds = ["a", "b", "c"]) {
      let time = NOW;
      const clock = () => time;
      const catalog = createMemeCatalog(memeIds.map((id) => ({ id, caption: id.toUpperCase(), file: `${id}.svg` })));
      const service = createSwipeService(catalog, createInMemorySwipeRepository({ now: clock }), { now: clock });
      let user = 0;
      // Each swipe comes from a new user, at the given time.
      const swipeAt = (at: number, memeId: string, direction: "like" | "nope", times = 1) => {
        time = at;
        for (let i = 0; i < times; i++) service.recordSwipe(`user${user++}`, memeId, direction);
        time = NOW;
      };
      return { service, swipeAt };
    }
    const ids = (memes: { id: string }[]) => memes.map((meme) => meme.id);

    it("is empty with the all-time window when nobody has swiped", () => {
      expect(trendingSetup().service.listTrending()).toEqual({ window: "all-time", memes: [] });
    });

    it("ranks by likes in the last 24 hours when there is enough activity", () => {
      const { service, swipeAt } = trendingSetup();
      // Long ago "a" was the favourite; today "b" is.
      swipeAt(NOW - 30 * 24 * HOUR, "a", "like", 20);
      swipeAt(NOW - HOUR, "b", "like", 6);
      swipeAt(NOW - HOUR, "a", "like", 4);

      const trending = service.listTrending();

      expect(trending.window).toBe("last-24-hours");
      expect(ids(trending.memes)).toEqual(["b", "a"]);
      expect(trending.memes.map((meme) => meme.windowLikes)).toEqual([6, 4]);
    });

    it("keeps all-time stats on the memes while ranking by the window", () => {
      const { service, swipeAt } = trendingSetup();
      swipeAt(NOW - 30 * 24 * HOUR, "a", "nope", 10);
      swipeAt(NOW - HOUR, "a", "like", MIN_SWIPES_FOR_TRENDING_WINDOW);

      const [meme] = service.listTrending().memes;

      expect(meme.windowLikes).toBe(MIN_SWIPES_FOR_TRENDING_WINDOW);
      expect(meme.stats).toEqual({ likes: 10, swipes: 20, likePercent: 50 });
    });

    it("counts a swipe exactly 24 hours old as inside the window", () => {
      const { service, swipeAt } = trendingSetup();
      swipeAt(NOW - TRENDING_WINDOW_HOURS * HOUR, "a", "like", MIN_SWIPES_FOR_TRENDING_WINDOW);

      expect(service.listTrending().window).toBe("last-24-hours");
    });

    it("falls back to all time when the last 24 hours have too few swipes", () => {
      const { service, swipeAt } = trendingSetup();
      swipeAt(NOW - 30 * 24 * HOUR, "a", "like", 20);
      swipeAt(NOW - HOUR, "b", "like", MIN_SWIPES_FOR_TRENDING_WINDOW - 1);

      const trending = service.listTrending();

      expect(trending.window).toBe("all-time");
      expect(ids(trending.memes)).toEqual(["a", "b"]);
      expect(trending.memes.map((meme) => meme.windowLikes)).toEqual([20, MIN_SWIPES_FOR_TRENDING_WINDOW - 1]);
    });

    it("breaks ties on likes by the share of likes, then by catalog order", () => {
      const { service, swipeAt } = trendingSetup(["a", "b", "c", "d"]);
      swipeAt(NOW, "d", "like", 3);
      swipeAt(NOW, "c", "like", 3);
      swipeAt(NOW, "a", "like", 3);
      swipeAt(NOW, "a", "nope", 3);

      expect(ids(service.listTrending().memes)).toEqual(["c", "d", "a"]);
    });

    it("leaves out memes without likes in the window", () => {
      const { service, swipeAt } = trendingSetup();
      swipeAt(NOW, "a", "nope", 5);
      swipeAt(NOW, "b", "like");

      expect(ids(service.listTrending().memes)).toEqual(["b"]);
    });

    it(`lists at most ${TRENDING_LIMIT} memes`, () => {
      const memeIds = Array.from({ length: TRENDING_LIMIT + 2 }, (_, i) => `m${i}`);
      const { service, swipeAt } = trendingSetup(memeIds);
      memeIds.forEach((id, i) => swipeAt(NOW, id, "like", i + 1));

      const trending = service.listTrending();

      expect(trending.memes).toHaveLength(TRENDING_LIMIT);
      expect(trending.memes[0].id).toBe(memeIds[memeIds.length - 1]);
    });

    it("stops counting a user's likes after that user resets", () => {
      const { service } = trendingSetup();
      service.recordSwipe("fan", "a", "like");

      service.resetSwipes("fan");

      expect(service.listTrending().memes).toEqual([]);
    });
  });

  describe("mergeSwipes", () => {
    it("gives the target the source's swipes, and the first swipe wins for a meme both swiped", () => {
      const service = setup();
      service.recordSwipe("profile", "a", "nope");
      service.recordSwipe("anonymous", "a", "like");
      service.recordSwipe("anonymous", "b", "like");

      service.mergeSwipes("anonymous", "profile");

      expect(service.listLikedMemes("profile").map((meme) => meme.id)).toEqual(["b"]);
      expect(service.getNextMeme("profile")).toBeNull();
      expect(service.getNextMeme("anonymous")?.id).toBe("a");
    });
  });
});
