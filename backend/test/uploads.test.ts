import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createInMemoryProfileRepository } from "../src/profiles/repository.js";
import { createProfileService } from "../src/profiles/service.js";
import { createSqliteMemeRepository } from "../src/memes/repository.js";
import { seedMemes } from "../src/memes/seed.js";
import { seedMemeRepository } from "../src/memes/seeding.js";
import { createMemeService } from "../src/memes/service.js";
import { MAX_SVG_BYTES, MAX_SVG_DEPTH, MAX_SVG_ELEMENTS, validateSvg } from "../src/memes/svg.js";
import { createInMemorySwipeRepository } from "../src/swipes/repository.js";
import { createSqliteSwipeRepository } from "../src/swipes/sqlite-repository.js";
import { createSwipeService } from "../src/swipes/service.js";

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="red"/></svg>';
const openResources = new Set<{ close(): void }>();
const temporaryDirectories: string[] = [];

function track<T extends { close(): void }>(resource: T): T {
  openResources.add(resource);
  return resource;
}

function close(resource: { close(): void }) {
  resource.close();
  openResources.delete(resource);
}

afterEach(() => {
  for (const resource of openResources) resource.close();
  openResources.clear();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function setup() {
  const repository = track(createSqliteMemeRepository(":memory:"));
  const memes = createMemeService(repository);
  const swipes = createInMemorySwipeRepository();
  const service = createSwipeService(memes, swipes);
  const app = createApp(service, createProfileService(createInMemoryProfileRepository()), {
    memeService: memes,
  });
  return { app, repository, memes, swipes, service };
}

function post(app: ReturnType<typeof createApp>, image: string = svg, caption = "A meme", userId = "poster") {
  return request(app)
    .post("/api/memes")
    .query({ caption })
    .set("X-User-Id", userId)
    .set("Content-Type", "image/svg+xml")
    .send(image);
}

describe("SVG upload service", () => {
  it("accepts passive SVG artwork and preserves its exact image content", () => {
    const { memes } = setup();
    const posted = memes.post("  A vector meme  ", svg);
    expect(posted).toMatchObject({ id: expect.any(String), caption: "A vector meme" });
    expect(posted.imageUrl).toBe(`/api/memes/${posted.id}/image.svg`);
    expect(memes.image(posted.id)).toBe(svg);
    expect(memes.list()).toEqual([posted]);
  });

  it("accepts harmless XML comments and preserves the original image", () => {
    const { memes } = setup();
    const image =
      '<svg xmlns="http://www.w3.org/2000/svg"><!-- artist notes: a red rectangle --><rect width="10" height="10" fill="red"/></svg>';
    const posted = memes.post("Commented artwork", image);
    expect(memes.image(posted.id)).toBe(image);
  });

  it("accepts passive gradients and local fragment references", () => {
    const artwork =
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gradient"><stop offset="0" stop-color="red"/></linearGradient></defs><rect width="10" height="10" fill="url(#gradient)"/><text x="1" y="2">hello</text></svg>';
    expect(() => validateSvg(artwork)).not.toThrow();
  });

  it.each([
    ["script", "<script>alert(1)</script>"],
    ["event handler", '<g onload="alert(1)"/>'],
    ["prefixed event handler", '<g xmlns:custom="urn:test" custom:onload="alert(1)"/>'],
    ["external href", '<use href="https://example.com/meme.svg#content"/>'],
    [
      "external xlink href",
      '<use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="https://example.com/meme.svg#content"/>',
    ],
    ["data href", '<use href="data:image/svg+xml;base64,PHN2Zy8+"/>'],
    ["javascript href", '<a href="javascript:alert(1)"><text>click</text></a>'],
    ["style attribute", '<rect style="fill:url(https://example.com/image.svg)"/>'],
    ["style element", "<style>rect{fill:url(https://example.com/image.svg)}</style>"],
    ["external presentation URL", '<rect fill="url(https://example.com/image.svg)"/>'],
    ["encoded external presentation URL", '<rect fill="u&#x72;l(https://example.com/image.svg)"/>'],
    [
      "CSS-escaped external presentation URL",
      String.raw`<rect fill="u\72l(https://example.com/image.svg)"/>`,
    ],
    [
      "foreign HTML",
      '<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">active content</div></foreignObject>',
    ],
    ["animated attribute", '<animate attributeName="fill" from="red" to="blue" dur="1s"/>'],
    [
      "animated transform",
      '<animateTransform attributeName="transform" type="rotate" from="0" to="90" dur="1s"/>',
    ],
    ["set element", '<set attributeName="href" to="https://example.com/external.svg"/>'],
    ["external image", '<image href="https://example.com/image.png"/>'],
  ])("rejects %s without storing or repairing the image", (_description, content) => {
    const { memes } = setup();
    expect(() =>
      memes.post("Unsafe meme", `<svg xmlns="http://www.w3.org/2000/svg">${content}</svg>`),
    ).toThrow();
    expect(memes.list()).toEqual([]);
  });

  it.each([
    "",
    "not an image",
    '<svg xmlns="http://www.w3.org/2000/svg"><rect></svg>',
    '<html xmlns="http://www.w3.org/1999/xhtml"/>',
    '<svg xmlns="https://example.com/not-svg"/>',
    '<!DOCTYPE svg [<!ENTITY x "entity">]><svg xmlns="http://www.w3.org/2000/svg"><text>&x;</text></svg>',
    '<?xml-stylesheet href="https://example.com/style.css"?><svg xmlns="http://www.w3.org/2000/svg"/>',
  ])("rejects malformed or unsupported SVG: %s", (image) => {
    expect(() => validateSvg(image)).toThrow();
  });

  it("enforces the 5 MiB limit in UTF-8 bytes rather than JavaScript characters", () => {
    const image = `<svg xmlns="http://www.w3.org/2000/svg"><text>${"😀".repeat(MAX_SVG_BYTES / 4)}</text></svg>`;
    expect(image.length).toBeLessThan(MAX_SVG_BYTES);
    expect(Buffer.byteLength(image, "utf8")).toBeGreaterThan(MAX_SVG_BYTES);
    expect(() => validateSvg(image)).toThrow("5 MB or smaller");
  });

  it("accepts exactly 5 MiB of passive SVG", () => {
    const prefix = '<svg xmlns="http://www.w3.org/2000/svg"><text>';
    const suffix = "</text></svg>";
    const image = prefix + "x".repeat(MAX_SVG_BYTES - prefix.length - suffix.length) + suffix;
    expect(Buffer.byteLength(image, "utf8")).toBe(MAX_SVG_BYTES);
    expect(() => validateSvg(image)).not.toThrow();
  });

  // Validation is synchronous: these would otherwise block the server for seconds.
  it("accepts the maximum number of elements and rejects one more, quickly", () => {
    const withRects = (count: number) =>
      `<svg xmlns="http://www.w3.org/2000/svg">${'<rect width="1"/>'.repeat(count - 1)}</svg>`;
    expect(() => validateSvg(withRects(MAX_SVG_ELEMENTS))).not.toThrow();

    const started = Date.now();
    expect(() => validateSvg(withRects(300_000))).toThrow(`at most ${MAX_SVG_ELEMENTS} elements`);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it("accepts the maximum nesting depth and rejects deeper nesting, quickly", () => {
    const nested = (levels: number) =>
      `<svg xmlns="http://www.w3.org/2000/svg">${"<g>".repeat(levels - 1)}${"</g>".repeat(levels - 1)}</svg>`;
    expect(() => validateSvg(nested(MAX_SVG_DEPTH))).not.toThrow();
    expect(() => validateSvg(nested(MAX_SVG_DEPTH + 1))).toThrow(`at most ${MAX_SVG_DEPTH} levels deep`);

    const started = Date.now();
    expect(() => validateSvg(nested(1500))).toThrow(`at most ${MAX_SVG_DEPTH} levels deep`);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it.each([undefined, null, 123, "", "   ", "x".repeat(501)])(
    "requires a caption of at most 500 characters",
    (caption) => {
      const { memes } = setup();
      expect(() => memes.post(caption, svg)).toThrow("Caption is required");
      expect(memes.list()).toEqual([]);
    },
  );

  it("allows a 500-character caption and rejects missing image content", () => {
    const { memes } = setup();
    expect(memes.post("x".repeat(500), svg).caption).toHaveLength(500);
    expect(() => memes.post("Caption", undefined)).toThrow("Choose an SVG image");
  });
});

describe("durable meme storage and seeding", () => {
  it("loads seed content once with stable IDs and leaves persisted entries unchanged", () => {
    const { repository, memes } = setup();
    const firstSeed = seedMemes[0];
    repository.add({ id: firstSeed.id, caption: "Persisted caption", svg, seed: true });
    const uploaded = memes.post("Existing upload", svg);
    seedMemeRepository(repository);
    seedMemeRepository(repository);
    expect(repository.list()).toHaveLength(seedMemes.length + 1);
    expect(
      repository
        .list()
        .filter((meme) => meme.seed)
        .map((meme) => meme.id)
        .sort(),
    ).toEqual(seedMemes.map((meme) => meme.id).sort());
    expect(repository.get(firstSeed.id)).toMatchObject({ caption: "Persisted caption", svg });
    expect(memes.getById(uploaded.id)).toEqual(uploaded);
  });

  it("keeps uploads, seed IDs and pre-existing swipe history after reopening the same database", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "meme-upload-tests-"));
    temporaryDirectories.push(directory);
    const filename = path.join(directory, "nested", "memes.db");
    // Existing installations already have swipe tables before durable memes are introduced.
    const originalSwipes = track(createSqliteSwipeRepository(filename));
    originalSwipes.add("existing-user", { memeId: seedMemes[0].id, direction: "like" });
    close(originalSwipes);

    const firstMemes = track(createSqliteMemeRepository(filename));
    seedMemeRepository(firstMemes);
    const uploaded = createMemeService(firstMemes).post("Durable upload", svg);
    const firstSwipes = track(createSqliteSwipeRepository(filename));
    firstSwipes.add("new-user", { memeId: uploaded.id, direction: "like" });
    close(firstSwipes);
    close(firstMemes);

    const reopenedMemes = track(createSqliteMemeRepository(filename));
    const reopenedSwipes = track(createSqliteSwipeRepository(filename));
    seedMemeRepository(reopenedMemes);
    const memes = createMemeService(reopenedMemes);
    const service = createSwipeService(memes, reopenedSwipes);
    expect(memes.image(uploaded.id)).toBe(svg);
    expect(memes.list()).toHaveLength(seedMemes.length + 1);
    expect(service.listLikedMemes("existing-user")[0].id).toBe(seedMemes[0].id);
    expect(service.listLikedMemes("new-user")[0]).toMatchObject({
      ...uploaded,
      stats: { likes: 1, swipes: 1, likePercent: null },
    });
    expect(service.listTrending().memes.map((meme) => meme.id)).toContain(uploaded.id);
  });
});

describe("SVG upload HTTP API", () => {
  it("posts for everyone, returns rated data, and does not shadow /memes/next", async () => {
    const { app } = setup();
    const response = await post(app);
    expect(response.status).toBe(201);
    const meme = response.body.meme;
    expect(meme).toMatchObject({
      id: expect.any(String),
      caption: "A meme",
      stats: { likes: 0, swipes: 0, likePercent: null },
    });
    const next = await request(app).get("/api/memes/next").set("X-User-Id", "other-user");
    expect(next.status).toBe(200);
    expect(next.body.meme).toEqual(meme);
    const direct = await request(app).get(`/api/memes/${meme.id}`).set("X-User-Id", "other-user");
    expect(direct.status).toBe(200);
    expect(direct.body.meme).toEqual(meme);
  });

  it("serves uploaded SVGs only as images with restrictive response headers", async () => {
    const { app } = setup();
    const response = await post(app);
    const image = await request(app).get(response.body.meme.imageUrl);
    expect(image.status).toBe(200);
    expect(image.headers["content-type"]).toContain("image/svg+xml");
    expect(image.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(image.headers["content-security-policy"]).toContain("sandbox");
    expect(image.headers["x-content-type-options"]).toBe("nosniff");
    expect(image.headers["cache-control"]).toBe("no-store");
    expect(image.text ?? image.body.toString("utf8")).toBe(svg);
  });

  it("preserves stats, Likes and Trending as uploaded memes are swiped and reset", async () => {
    const { app } = setup();
    const uploaded = (await post(app)).body.meme;
    for (let index = 0; index < 5; index++) {
      const swipe = await request(app)
        .post("/api/swipes")
        .set("X-User-Id", `user-${index}`)
        .send({ memeId: uploaded.id, direction: index === 4 ? "nope" : "like" });
      expect(swipe.status).toBe(200);
    }
    const expectedStats = { likes: 4, swipes: 5, likePercent: 80 };
    const direct = await request(app).get(`/api/memes/${uploaded.id}`).set("X-User-Id", "viewer");
    expect(direct.body.meme.stats).toEqual(expectedStats);
    const likes = await request(app).get("/api/likes").set("X-User-Id", "user-0");
    expect(likes.body.memes).toEqual([{ ...uploaded, stats: expectedStats }]);
    const trending = await request(app).get("/api/trending").set("X-User-Id", "viewer");
    expect(trending.body).toMatchObject({
      window: "all-time",
      memes: [{ id: uploaded.id, windowLikes: 4, stats: expectedStats }],
    });
    expect((await request(app).delete("/api/swipes").set("X-User-Id", "user-4")).status).toBe(204);
    const reset = await request(app).get(`/api/memes/${uploaded.id}`).set("X-User-Id", "viewer");
    expect(reset.body.meme.stats).toEqual({ likes: 4, swipes: 4, likePercent: null });
  });

  it("requires a user identity for posting and reading a meme", async () => {
    const { app, memes } = setup();
    const uploaded = memes.post("Known meme", svg);
    const anonymousPost = await request(app)
      .post("/api/memes")
      .query({ caption: "Caption" })
      .set("Content-Type", "image/svg+xml")
      .send(svg);
    expect(anonymousPost.status).toBe(400);
    expect(anonymousPost.body.error).toContain("X-User-Id");
    expect((await request(app).get(`/api/memes/${uploaded.id}`)).status).toBe(400);
  });

  it.each([
    ["missing caption", svg, ""],
    ["invalid SVG", "not SVG", "Caption"],
    ["script", '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "Caption"],
    ["event handler", '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>', "Caption"],
    [
      "external reference",
      '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://example.com/image.svg"/></svg>',
      "Caption",
    ],
  ])("returns JSON 400 for %s", async (_description, image, caption) => {
    const { app, memes } = setup();
    const response = await post(app, image, caption);
    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(expect.any(String));
    expect(memes.list()).toEqual([]);
  });

  it("returns JSON 400 for a non-SVG request type", async () => {
    const { app } = setup();
    const response = await request(app)
      .post("/api/memes")
      .query({ caption: "Caption" })
      .set("X-User-Id", "poster")
      .set("Content-Type", "text/plain")
      .send(svg);
    expect(response.status).toBe(400);
    expect(response.body.error).toContain("SVG");
  });

  it("returns a friendly 400 rather than an internal error for an unsupported prefixed SVG root", async () => {
    const { app, memes } = setup();
    const image = '<s:svg xmlns:s="http://www.w3.org/2000/svg"><s:rect width="10" height="10"/></s:svg>';
    const response = await post(app, image);
    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(expect.any(String));
    expect(response.body.error).not.toContain("root node is forbidden");
    expect(memes.list()).toEqual([]);
  });

  it("rejects compressed uploads before parsing or storing their contents", async () => {
    const { app, memes } = setup();
    const response = await request(app)
      .post("/api/memes")
      .query({ caption: "Compressed SVG" })
      .set("X-User-Id", "poster")
      .set("Content-Type", "image/svg+xml")
      .set("Content-Encoding", "gzip")
      .send(gzipSync(svg));
    expect(response.status).toBe(415);
    expect(response.body.error).toEqual(expect.any(String));
    expect(memes.list()).toEqual([]);
  });

  it("returns JSON 400 for an upload above the body-size limit", async () => {
    const { app } = setup();
    const response = await post(app, "x".repeat(MAX_SVG_BYTES + 1));
    expect(response.status).toBe(400);
    expect(response.body.error).toContain("5 MB");
  });

  it("returns JSON 404 for unknown meme metadata or image", async () => {
    const { app } = setup();
    const metadata = await request(app).get("/api/memes/unknown").set("X-User-Id", "viewer");
    const image = await request(app).get("/api/memes/unknown/image.svg");
    expect(metadata.status).toBe(404);
    expect(image.status).toBe(404);
    expect(metadata.body).toEqual({ error: "Meme not found" });
    expect(image.body).toEqual({ error: "Meme not found" });
  });
});
