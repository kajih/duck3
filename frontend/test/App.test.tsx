import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";

const newMeme = { likes: 0, swipes: 0, likePercent: null };
const first = { id: "m1", caption: "It works on my machine", imageUrl: "/api/memes/images/m1.svg", stats: newMeme };
const second = { id: "m2", caption: "Friday deploy", imageUrl: "/api/memes/images/m2.svg", stats: newMeme };

const ok = (body: unknown) => ({ ok: true, json: async () => body });

afterEach(() => vi.unstubAllGlobals());

describe("App", () => {
  it("shows the meme returned by the backend", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ meme: first })));

    render(<App />);

    const image = await screen.findByRole("img", { name: first.caption });
    expect(image).toHaveAttribute("src", first.imageUrl);
  });

  it.each([
    ["Like", "like"],
    ["Nope", "nope"],
  ])("sends a %s swipe and shows the next meme", async (label, direction) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ meme: first }))
      .mockResolvedValueOnce(ok({ memeId: first.id, direction }))
      .mockResolvedValueOnce(ok({ meme: second }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await screen.findByRole("img", { name: first.caption });

    fireEvent.click(screen.getByRole("button", { name: label }));

    expect(await screen.findByRole("img", { name: second.caption })).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/swipes");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ memeId: first.id, direction });
    expect(init.headers["X-User-Id"]).toEqual(expect.any(String));
  });

  it("swipes with the arrow keys in the swipe view but not in the likes view", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ meme: first }))
      .mockResolvedValueOnce(ok({ memeId: first.id, direction: "like" }))
      .mockResolvedValueOnce(ok({ meme: second }))
      .mockResolvedValueOnce(ok({ memes: [] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await screen.findByRole("img", { name: first.caption });

    fireEvent.keyDown(window, { key: "ArrowRight" });
    await screen.findByRole("img", { name: second.caption });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ memeId: first.id, direction: "like" });

    fireEvent.click(screen.getByRole("button", { name: "Likes" }));
    await screen.findByText("You have not liked any memes yet.");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("sends only one swipe while a swipe request is in flight", async () => {
    let finish: (value: unknown) => void = () => {};
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ meme: first }))
      .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
      .mockResolvedValueOnce(ok({ meme: second }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await screen.findByRole("img", { name: first.caption });

    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    finish(ok({ memeId: first.id, direction: "like" }));

    await screen.findByRole("img", { name: second.caption });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("brings in the next card with an entrance and blocks swipes until it is done", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ meme: first }))
      .mockResolvedValueOnce(ok({ memeId: first.id, direction: "like" }))
      .mockResolvedValueOnce(ok({ meme: second }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    const firstCard = (await screen.findByRole("img", { name: first.caption })).closest("figure");
    expect(firstCard).not.toHaveClass("entering");

    fireEvent.click(screen.getByRole("button", { name: "Like" }));
    const nextCard = (await screen.findByRole("img", { name: second.caption })).closest("figure");

    expect(nextCard).toHaveClass("entering");
    expect(screen.getByRole("button", { name: "Like" })).toBeDisabled();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Like" })).toBeEnabled());
    expect(nextCard).not.toHaveClass("entering");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("shows the empty state with a Reset button when there are no more memes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ meme: null })));

    render(<App />);

    expect(await screen.findByText("You have seen all memes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Like" })).not.toBeInTheDocument();
  });

  it("resets the swipe history and shows a meme again when Reset is clicked", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ meme: null }))
      .mockResolvedValueOnce({ ok: true, status: 204 })
      .mockResolvedValueOnce(ok({ meme: first }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Reset" }));

    expect(await screen.findByRole("img", { name: first.caption })).toBeInTheDocument();
    expect(screen.queryByText("You have seen all memes")).not.toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/swipes");
    expect(init.method).toBe("DELETE");
    expect(init.headers["X-User-Id"]).toEqual(expect.any(String));
  });

  it("shows an error message when the reset fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(ok({ meme: null })).mockResolvedValueOnce({ ok: false, status: 500 }),
    );
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Reset" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("shows an error message when the backend fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("shows an error message when the backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to fetch");
  });

  it("shows an error message when recording a swipe fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(ok({ meme: first })).mockResolvedValueOnce({ ok: false, status: 500 }),
    );
    render(<App />);
    await screen.findByRole("img", { name: first.caption });

    fireEvent.click(screen.getByRole("button", { name: "Like" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("brings the card back without a stamp when recording a swipe fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(ok({ meme: first })).mockResolvedValueOnce({ ok: false, status: 500 }),
    );
    render(<App />);
    await screen.findByRole("img", { name: first.caption });

    fireEvent.click(screen.getByRole("button", { name: "Like" }));
    expect(screen.getByText("LIKE")).toBeVisible();
    await screen.findByRole("alert");

    expect(screen.getByText("LIKE")).not.toBeVisible();
    expect(screen.getByRole("button", { name: "Like" })).toBeEnabled();
  });

  describe("likes view", () => {
    it("lists the liked memes when the Likes button is clicked", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(ok({ meme: first }))
        .mockResolvedValueOnce(ok({ memes: [first, second] }));
      vi.stubGlobal("fetch", fetchMock);
      render(<App />);
      await screen.findByRole("img", { name: first.caption });

      fireEvent.click(screen.getByRole("button", { name: "Likes" }));

      expect(await screen.findByRole("heading", { name: "Your likes" })).toBeInTheDocument();
      expect(screen.getByRole("img", { name: first.caption })).toHaveAttribute("src", first.imageUrl);
      expect(screen.getByRole("img", { name: second.caption })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Like" })).not.toBeInTheDocument();
      expect(fetchMock.mock.calls[1][0]).toBe("/api/likes");
      expect(fetchMock.mock.calls[1][1].headers["X-User-Id"]).toEqual(expect.any(String));
    });

    it("shows an empty message when nothing is liked", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(ok({ meme: first })).mockResolvedValueOnce(ok({ memes: [] })));
      render(<App />);
      await screen.findByRole("img", { name: first.caption });

      fireEvent.click(screen.getByRole("button", { name: "Likes" }));

      expect(await screen.findByText("You have not liked any memes yet.")).toBeInTheDocument();
    });

    it("navigates back to the swipe view", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(ok({ meme: first }))
          .mockResolvedValueOnce(ok({ memes: [] }))
          .mockResolvedValueOnce(ok({ meme: first })),
      );
      render(<App />);
      await screen.findByRole("img", { name: first.caption });
      fireEvent.click(screen.getByRole("button", { name: "Likes" }));
      await screen.findByText("You have not liked any memes yet.");

      fireEvent.click(screen.getByRole("button", { name: "Swipe" }));

      expect(await screen.findByRole("img", { name: first.caption })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Like" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Your likes" })).not.toBeInTheDocument();
    });

    it("shows an error message when loading likes fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValueOnce(ok({ meme: first })).mockResolvedValueOnce({ ok: false, status: 500 }),
      );
      render(<App />);
      await screen.findByRole("img", { name: first.caption });

      fireEvent.click(screen.getByRole("button", { name: "Likes" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
      expect(screen.queryByText("You have not liked any memes yet.")).not.toBeInTheDocument();
    });
  });

  describe("trending view", () => {
    it("shows the trending memes from the backend when the Trending tab is used", async () => {
      const trending = {
        window: "last-24-hours",
        memes: [{ ...second, windowLikes: 7, stats: { likes: 9, swipes: 10, likePercent: 90 } }],
      };
      const fetchMock = vi.fn().mockResolvedValueOnce(ok({ meme: first })).mockResolvedValueOnce(ok(trending));
      vi.stubGlobal("fetch", fetchMock);
      render(<App />);
      await screen.findByRole("img", { name: first.caption });

      fireEvent.click(screen.getByRole("button", { name: "Trending" }));

      expect(await screen.findByRole("heading", { name: "Trending" })).toBeInTheDocument();
      expect(screen.getByRole("img", { name: second.caption })).toBeInTheDocument();
      expect(screen.getByText("7 likes today")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Trending" })).toHaveAttribute("aria-current", "page");
      expect(screen.queryByRole("button", { name: "Like" })).not.toBeInTheDocument();
      expect(fetchMock.mock.calls[1][0]).toBe("/api/trending");
      expect(fetchMock.mock.calls[1][1].headers["X-User-Id"]).toEqual(expect.any(String));
    });

    it("shows an error message when loading trending fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValueOnce(ok({ meme: first })).mockResolvedValueOnce({ ok: false, status: 500 }),
      );
      render(<App />);
      await screen.findByRole("img", { name: first.caption });

      fireEvent.click(screen.getByRole("button", { name: "Trending" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    });
  });
});
