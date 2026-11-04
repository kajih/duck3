import { afterEach, describe, expect, it, vi } from "vitest";
import { postMeme } from "../src/api";

afterEach(() => vi.unstubAllGlobals());

const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
const file = () => new File([svg], "meme.svg", { type: "image/svg+xml" });
const meme = {
  id: "posted",
  caption: "a & b",
  imageUrl: "/api/memes/posted/image.svg",
  stats: { likes: 0, swipes: 0, likePercent: null },
};

describe("postMeme", () => {
  it("reads the selected file and sends raw SVG with the encoded caption and anonymous identity", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ meme }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(postMeme(file(), " a & b ")).resolves.toEqual(meme);
    expect(fetchMock).toHaveBeenCalledWith("/api/memes?caption=a%20%26%20b", {
      method: "POST",
      headers: { "Content-Type": "image/svg+xml", "X-User-Id": expect.any(String) },
      body: svg,
    });
  });

  it("preserves server validation errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: "Unsafe SVG image" }) }),
    );
    await expect(postMeme(file(), "caption")).rejects.toThrow("Unsafe SVG image");
  });

  it("falls back to the HTTP status if the server error is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError("Not JSON");
        },
      }),
    );
    await expect(postMeme(file(), "caption")).rejects.toThrow("Request failed (HTTP 502)");
  });
});
