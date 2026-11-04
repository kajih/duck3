import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createDeviceLinkService } from "../src/devices/service.js";
import { createMemeCatalog } from "../src/memes/catalog.js";
import { createInMemoryProfileRepository } from "../src/profiles/repository.js";
import { createProfileService } from "../src/profiles/service.js";
import { createInMemorySwipeRepository } from "../src/swipes/repository.js";
import { createSwipeService } from "../src/swipes/service.js";

let staticDir: string;

beforeAll(() => {
  staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "meme-tinder-static-"));
  fs.writeFileSync(path.join(staticDir, "index.html"), "<html>app shell</html>");
  fs.writeFileSync(path.join(staticDir, "app.js"), "console.log('app');");
});

afterAll(() => fs.rmSync(staticDir, { recursive: true, force: true }));

const setup = (options?: { staticDir?: string }) => {
  const swipes = createSwipeService(createMemeCatalog(), createInMemorySwipeRepository());
  const profiles = createProfileService(createInMemoryProfileRepository());
  return createApp(swipes, profiles, createDeviceLinkService({ swipes, profiles }), options);
};

describe("static frontend serving", () => {
  it("serves index.html at / and built files by path", async () => {
    const app = setup({ staticDir });

    expect((await request(app).get("/")).text).toContain("app shell");
    expect((await request(app).get("/app.js")).text).toContain("console.log");
  });

  it("falls back to index.html for unknown non-API paths", async () => {
    const res = await request(setup({ staticDir })).get("/likes");

    expect(res.status).toBe(200);
    expect(res.text).toContain("app shell");
  });

  it("keeps /api routes working", async () => {
    const app = setup({ staticDir });

    const res = await request(app).get("/api/memes/next").set("X-User-Id", "u1");
    expect(res.status).toBe(200);
    expect(res.body.meme).toEqual(expect.objectContaining({ id: expect.any(String) }));
    expect((await request(app).get("/api/memes/next")).status).toBe(400);
  });

  it("does not answer unknown /api paths with the app shell", async () => {
    const res = await request(setup({ staticDir })).get("/api/nope");

    expect(res.status).toBe(404);
    expect(res.text).not.toContain("app shell");
  });

  it("serves no frontend when no static directory is configured", async () => {
    const res = await request(setup()).get("/");

    expect(res.status).toBe(404);
  });
});
