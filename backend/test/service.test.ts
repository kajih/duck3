import { describe, expect, it } from "vitest";
import { createMemeCatalog } from "../src/memes/catalog.js";
import { createInMemorySwipeRepository } from "../src/swipes/repository.js";
import { createSwipeService, MIN_SWIPES_FOR_PERCENT, UnknownMemeError } from "../src/swipes/service.js";

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
});
