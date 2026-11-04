import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SWIPE_THRESHOLD, MemeCard } from "../src/MemeCard";

const newMeme = { likes: 0, swipes: 0, likePercent: null };
const meme = { id: "m1", caption: "It works on my machine", imageUrl: "/api/memes/images/m1.svg", stats: newMeme };

function setup(disabled = false) {
  const onSwipe = vi.fn();
  render(<MemeCard meme={meme} onSwipe={onSwipe} disabled={disabled} />);
  return { onSwipe, card: screen.getByRole("img", { name: meme.caption }).closest("figure")! };
}

function drag(card: HTMLElement, distance: number) {
  fireEvent.pointerDown(card, { clientX: 200, pointerId: 1 });
  fireEvent.pointerMove(card, { clientX: 200 + distance, pointerId: 1 });
  fireEvent.pointerUp(card, { clientX: 200 + distance, pointerId: 1 });
}

describe("MemeCard", () => {
  it("shows how much people loved the meme", () => {
    const loved = { ...meme, stats: { likes: 87, swipes: 100, likePercent: 87 } };
    render(<MemeCard meme={loved} onSwipe={vi.fn()} />);

    expect(screen.getByText("87% of people loved this")).toBeInTheDocument();
  });

  it("shows New meme while there are too few swipes for a percentage", () => {
    setup();

    expect(screen.getByText("New meme")).toBeInTheDocument();
    expect(screen.queryByText(/% of people loved this/)).not.toBeInTheDocument();
  });

  it("shows the meme image with the caption as alt text", () => {
    setup();

    expect(screen.getByRole("img", { name: meme.caption })).toHaveAttribute("src", meme.imageUrl);
  });

  it.each([
    ["Like", "like"],
    ["Nope", "nope"],
  ])("calls onSwipe with %s when its button is clicked", (label, direction) => {
    const { onSwipe } = setup();

    fireEvent.click(screen.getByRole("button", { name: label }));

    expect(onSwipe).toHaveBeenCalledExactlyOnceWith(direction);
  });

  it.each([
    ["ArrowRight", "like"],
    ["ArrowLeft", "nope"],
  ])("calls onSwipe when %s is pressed", (key, direction) => {
    const { onSwipe } = setup();

    fireEvent.keyDown(window, { key });

    expect(onSwipe).toHaveBeenCalledExactlyOnceWith(direction);
  });

  it("ignores other keys", () => {
    const { onSwipe } = setup();

    fireEvent.keyDown(window, { key: "ArrowUp" });

    expect(onSwipe).not.toHaveBeenCalled();
  });

  it.each([
    [SWIPE_THRESHOLD, "like"],
    [-SWIPE_THRESHOLD, "nope"],
  ])("calls onSwipe when dragged %ipx", (distance, direction) => {
    const { onSwipe, card } = setup();

    drag(card, distance);

    expect(onSwipe).toHaveBeenCalledExactlyOnceWith(direction);
  });

  it("follows the pointer while dragging and snaps back when released before the threshold", () => {
    const { onSwipe, card } = setup();

    fireEvent.pointerDown(card, { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(card, { clientX: 250, pointerId: 1 });
    expect(card.style.transform).toContain("translateX(50px)");
    fireEvent.pointerUp(card, { clientX: 250, pointerId: 1 });

    expect(onSwipe).not.toHaveBeenCalled();
    expect(card.style.transform).toContain("translateX(0px)");
  });

  it("does nothing when disabled", () => {
    const { onSwipe, card } = setup(true);

    drag(card, SWIPE_THRESHOLD * 2);
    fireEvent.keyDown(window, { key: "ArrowRight" });

    expect(onSwipe).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Like" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Nope" })).toBeDisabled();
  });
});
