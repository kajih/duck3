import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Trending, TrendingMeme } from "../src/api";
import { TrendingView } from "../src/TrendingView";

function meme(id: string, windowLikes: number, likePercent: number | null = null): TrendingMeme {
  return {
    id,
    caption: `Meme ${id}`,
    imageUrl: `/api/memes/images/${id}.svg`,
    windowLikes,
    stats: { likes: windowLikes, swipes: 10, likePercent },
  };
}

describe("TrendingView", () => {
  it("lists the memes in the given order, ranked from 1", () => {
    const trending: Trending = {
      window: "last-24-hours",
      memes: [meme("a", 8, 80), meme("b", 3), meme("c", 1)],
    };

    render(<TrendingView trending={trending} />);

    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((item) => within(item).getByRole("img").getAttribute("alt"))).toEqual([
      "Meme a",
      "Meme b",
      "Meme c",
    ]);
    expect(items[0]).toHaveTextContent(/^1/);
    expect(items[2]).toHaveTextContent(/^3/);
  });

  it("shows the likes in the window and the like percentage", () => {
    render(<TrendingView trending={{ window: "last-24-hours", memes: [meme("a", 8, 80), meme("b", 1)] }} />);

    expect(screen.getByText("8 likes today")).toBeInTheDocument();
    expect(screen.getByText("80% of people loved this")).toBeInTheDocument();
    expect(screen.getByText("1 like today")).toBeInTheDocument();
    expect(screen.getByText("New meme")).toBeInTheDocument();
  });

  it("says when trending covers the last 24 hours", () => {
    render(<TrendingView trending={{ window: "last-24-hours", memes: [meme("a", 2)] }} />);

    expect(screen.getByText("Most liked in the last 24 hours")).toBeInTheDocument();
  });

  it("says when it falls back to all time", () => {
    render(<TrendingView trending={{ window: "all-time", memes: [meme("a", 2)] }} />);

    expect(screen.getByText("A quiet day, so: most liked of all time")).toBeInTheDocument();
    expect(screen.getByText("2 likes all time")).toBeInTheDocument();
  });

  it("shows an empty state when nothing is trending", () => {
    render(<TrendingView trending={{ window: "all-time", memes: [] }} />);

    expect(screen.getByRole("heading", { name: "Trending" })).toBeInTheDocument();
    expect(screen.getByText(/Nothing is trending yet/)).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
