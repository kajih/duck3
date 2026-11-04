import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getUserId } from "../src/identity";
import { redeemLinkFromUrl } from "../src/linking";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe("redeemLinkFromUrl", () => {
  it("does nothing when the page was opened without a link", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await redeemLinkFromUrl()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("joins the profile, switches to its user id and takes the code out of the address", async () => {
    window.history.replaceState(null, "", "/?link=K7QM-4TXD&x=1");
    const anonymous = getUserId();
    const fetchMock = vi.fn().mockResolvedValue(ok({ userId: "profile-owner" }));
    vi.stubGlobal("fetch", fetchMock);

    const notice = await redeemLinkFromUrl();

    expect(notice).toEqual({ kind: "success", message: expect.stringContaining("linked") });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/device-links/redeem");
    expect(JSON.parse(init.body)).toEqual({ code: "K7QM-4TXD" });
    expect(init.headers["X-User-Id"]).toBe(anonymous);
    expect(getUserId()).toBe("profile-owner");
    expect(window.location.search).toBe("?x=1");
  });

  it("shows the server's message for a used or expired code, and keeps the user id", async () => {
    window.history.replaceState(null, "", "/?link=AAAA-AAAA");
    const anonymous = getUserId();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "That code does not work. It may have been used or expired." }),
      }),
    );

    const notice = await redeemLinkFromUrl();

    expect(notice).toEqual({
      kind: "error",
      message: "That code does not work. It may have been used or expired.",
    });
    expect(getUserId()).toBe(anonymous);
    expect(window.location.search).toBe("");
  });

  it("shows a general message when the request fails", async () => {
    window.history.replaceState(null, "", "/?link=K7QM-4TXD");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    expect(await redeemLinkFromUrl()).toEqual({
      kind: "error",
      message: expect.stringContaining("Could not link"),
    });
  });
});
