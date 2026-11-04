import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createMemeCatalog } from "../src/memes/catalog.js";
import { createInMemorySwipeRepository } from "../src/swipes/repository.js";
import { createSwipeService } from "../src/swipes/service.js";

// Every call builds fresh state, so tests are independent.
function setup() {
  const catalog = createMemeCatalog();
  return createApp(createSwipeService(catalog, createInMemorySwipeRepository()));
}

const swipe = (app: ReturnType<typeof setup>, userId: string, body: object) =>
  request(app).post("/api/swipes").set("X-User-Id", userId).send(body);

const next = (app: ReturnType<typeof setup>, userId: string) =>
  request(app).get("/api/memes/next").set("X-User-Id", userId);

describe("GET /api/memes/next", () => {
  it("returns a meme with an id, caption and image url", async () => {
    const res = await next(setup(), "u1");

    expect(res.status).toBe(200);
    expect(res.body.meme).toEqual({
      id: expect.any(String),
      caption: expect.any(String),
      imageUrl: expect.stringMatching(/\.svg$/),
      stats: { likes: 0, swipes: 0, likePercent: null },
    });
  });

  it("includes how much other users loved the meme", async () => {
    const app = setup();
    const { body } = await next(app, "viewer");
    for (const [i, direction] of ["like", "like", "like", "nope", "like"].entries()) {
      await swipe(app, `u${i}`, { memeId: body.meme.id, direction });
    }

    const res = await next(app, "viewer");

    expect(res.body.meme.stats).toEqual({ likes: 4, swipes: 5, likePercent: 80 });
  });

  it("serves the image the meme points to", async () => {
    const app = setup();
    const { body } = await next(app, "u1");

    const image = await request(app).get(body.meme.imageUrl);

    expect(image.status).toBe(200);
    expect(image.headers["content-type"]).toContain("image/svg+xml");
  });

  it("rejects a request without a user id", async () => {
    const res = await request(setup()).get("/api/memes/next");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/X-User-Id/);
  });

  it("rejects an empty user id", async () => {
    const res = await request(setup()).get("/api/memes/next").set("X-User-Id", "  ");

    expect(res.status).toBe(400);
  });

  it("never returns a meme the user has already swiped", async () => {
    const app = setup();
    const seen = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const { body } = await next(app, "u1");
      expect(seen.has(body.meme.id)).toBe(false);
      seen.add(body.meme.id);
      await swipe(app, "u1", { memeId: body.meme.id, direction: i % 2 ? "nope" : "like" });
    }
  });

  it("keeps users independent", async () => {
    const app = setup();
    const first = (await next(app, "u1")).body.meme;
    await swipe(app, "u1", { memeId: first.id, direction: "like" });

    expect((await next(app, "u1")).body.meme.id).not.toBe(first.id);
    expect((await next(app, "u2")).body.meme.id).toBe(first.id);
  });

  it("returns { meme: null } when every meme has been swiped", async () => {
    const app = setup();
    for (;;) {
      const { meme } = (await next(app, "u1")).body;
      if (!meme) break;
      await swipe(app, "u1", { memeId: meme.id, direction: "nope" });
    }

    const res = await next(app, "u1");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ meme: null });
  });
});

describe("POST /api/swipes", () => {
  it("records a swipe", async () => {
    const app = setup();
    const { meme } = (await next(app, "u1")).body;

    const res = await swipe(app, "u1", { memeId: meme.id, direction: "like" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ memeId: meme.id, direction: "like" });
  });

  it("rejects a request without a user id", async () => {
    const res = await request(setup()).post("/api/swipes").send({ memeId: "x", direction: "like" });

    expect(res.status).toBe(400);
  });

  it("rejects an invalid direction", async () => {
    const app = setup();
    const { meme } = (await next(app, "u1")).body;

    const res = await swipe(app, "u1", { memeId: meme.id, direction: "sideways" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/direction/);
  });

  it("rejects a missing meme id", async () => {
    const res = await swipe(setup(), "u1", { direction: "like" });

    expect(res.status).toBe(400);
  });

  it("rejects a request without a body", async () => {
    const res = await request(setup()).post("/api/swipes").set("X-User-Id", "u1");

    expect(res.status).toBe(400);
  });

  it("rejects malformed JSON with a JSON error", async () => {
    const res = await request(setup())
      .post("/api/swipes")
      .set("X-User-Id", "u1")
      .set("Content-Type", "application/json")
      .send("{not json");

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it("returns 404 for an unknown meme id", async () => {
    const res = await swipe(setup(), "u1", { memeId: "does-not-exist", direction: "like" });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/does-not-exist/);
  });

  it("keeps the first swipe when the same meme is swiped twice", async () => {
    const app = setup();
    const { meme } = (await next(app, "u1")).body;
    await swipe(app, "u1", { memeId: meme.id, direction: "like" });

    const res = await swipe(app, "u1", { memeId: meme.id, direction: "nope" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ memeId: meme.id, direction: "like" });
    expect((await next(app, "u1")).body.meme.id).not.toBe(meme.id);
  });
});

describe("DELETE /api/swipes", () => {
  const reset = (app: ReturnType<typeof setup>, userId: string) =>
    request(app).delete("/api/swipes").set("X-User-Id", userId);

  async function swipeEverything(app: ReturnType<typeof setup>, userId: string) {
    const ids: string[] = [];
    for (;;) {
      const { meme } = (await next(app, userId)).body;
      if (!meme) return ids;
      ids.push(meme.id);
      await swipe(app, userId, { memeId: meme.id, direction: "like" });
    }
  }

  it("resets the swipes so next returns memes again", async () => {
    const app = setup();
    const ids = await swipeEverything(app, "u1");

    const res = await reset(app, "u1");

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect((await next(app, "u1")).body.meme.id).toBe(ids[0]);
  });

  it("rejects a request without a user id", async () => {
    const res = await request(setup()).delete("/api/swipes");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/X-User-Id/);
  });

  it("does not affect other users", async () => {
    const app = setup();
    await swipeEverything(app, "u1");
    await swipeEverything(app, "u2");

    await reset(app, "u1");

    expect((await next(app, "u1")).body.meme).not.toBeNull();
    expect((await next(app, "u2")).body).toEqual({ meme: null });
  });

  it("is safe to call repeatedly", async () => {
    const app = setup();

    expect((await reset(app, "u1")).status).toBe(204);
    expect((await reset(app, "u1")).status).toBe(204);
  });
});

describe("GET /api/likes", () => {
  const likes = (app: ReturnType<typeof setup>, userId: string) =>
    request(app).get("/api/likes").set("X-User-Id", userId);

  it("returns an empty list when the user has not liked anything", async () => {
    const res = await likes(setup(), "u1");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ memes: [] });
  });

  it("returns liked memes but not nopes", async () => {
    const app = setup();
    const first = (await next(app, "u1")).body.meme;
    await swipe(app, "u1", { memeId: first.id, direction: "nope" });
    const second = (await next(app, "u1")).body.meme;
    await swipe(app, "u1", { memeId: second.id, direction: "like" });

    const res = await likes(app, "u1");

    expect(res.status).toBe(200);
    // The stats now include the user's own like.
    expect(res.body.memes).toEqual([{ ...second, stats: { likes: 1, swipes: 1, likePercent: null } }]);
  });

  it("returns likes in the same order every time", async () => {
    const app = setup();
    for (let i = 0; i < 3; i++) {
      const { meme } = (await next(app, "u1")).body;
      await swipe(app, "u1", { memeId: meme.id, direction: "like" });
    }

    const a = await likes(app, "u1");
    const b = await likes(app, "u1");

    expect(a.body.memes).toHaveLength(3);
    expect(a.body).toEqual(b.body);
  });

  it("does not leak other users' likes", async () => {
    const app = setup();
    const { meme } = (await next(app, "u1")).body;
    await swipe(app, "u1", { memeId: meme.id, direction: "like" });

    expect((await likes(app, "u2")).body).toEqual({ memes: [] });
  });

  it("is empty after the swipes are reset", async () => {
    const app = setup();
    const { meme } = (await next(app, "u1")).body;
    await swipe(app, "u1", { memeId: meme.id, direction: "like" });
    await request(app).delete("/api/swipes").set("X-User-Id", "u1");

    expect((await likes(app, "u1")).body).toEqual({ memes: [] });
  });

  it("rejects a missing user id", async () => {
    const res = await request(setup()).get("/api/likes");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: expect.any(String) });
  });
});

describe("GET /api/trending", () => {
  const trending = (app: ReturnType<typeof setup>, userId: string) =>
    request(app).get("/api/trending").set("X-User-Id", userId);

  it("returns an empty all-time list when nobody has swiped", async () => {
    const res = await trending(setup(), "u1");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ window: "all-time", memes: [] });
  });

  it("returns the most liked memes across all users with their likes and stats", async () => {
    const app = setup();
    const { meme: first } = (await next(app, "u1")).body;
    await swipe(app, "u1", { memeId: first.id, direction: "like" });
    await swipe(app, "u2", { memeId: first.id, direction: "like" });
    const { meme: second } = (await next(app, "u1")).body;
    await swipe(app, "u3", { memeId: second.id, direction: "like" });

    const res = await trending(app, "someone-else");

    expect(res.status).toBe(200);
    expect(res.body.window).toBe("all-time");
    expect(res.body.memes).toEqual([
      { ...first, windowLikes: 2, stats: { likes: 2, swipes: 2, likePercent: null } },
      { ...second, windowLikes: 1, stats: { likes: 1, swipes: 1, likePercent: null } },
    ]);
  });

  it("rejects a missing user id", async () => {
    const res = await request(setup()).get("/api/trending");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: expect.any(String) });
  });
});
