import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CARD_ENTER_MS, SWIPE_EXIT_MS, SWIPE_THRESHOLD, MemeCard } from "../src/MemeCard";

const newMeme = { likes: 0, swipes: 0, likePercent: null };
const meme = {
  id: "m1",
  caption: "It works on my machine",
  imageUrl: "/api/memes/images/m1.svg",
  stats: newMeme,
};

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

function finishExit() {
  act(() => vi.advanceTimersByTime(SWIPE_EXIT_MS));
}

const likeStamp = () => screen.getByText("LIKE");
const nopeStamp = () => screen.getByText("NOPE");

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

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
  ])("calls onSwipe with %s when its button is clicked, after the card has left", (label, direction) => {
    const { onSwipe } = setup();

    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(onSwipe).not.toHaveBeenCalled();
    finishExit();

    expect(onSwipe).toHaveBeenCalledExactlyOnceWith(direction);
  });

  it.each([
    ["ArrowRight", "like"],
    ["ArrowLeft", "nope"],
  ])("calls onSwipe when %s is pressed", (key, direction) => {
    const { onSwipe } = setup();

    fireEvent.keyDown(window, { key });
    finishExit();

    expect(onSwipe).toHaveBeenCalledExactlyOnceWith(direction);
  });

  it("ignores other keys", () => {
    const { onSwipe } = setup();

    fireEvent.keyDown(window, { key: "ArrowUp" });
    finishExit();

    expect(onSwipe).not.toHaveBeenCalled();
  });

  it.each([
    [SWIPE_THRESHOLD, "like"],
    [-SWIPE_THRESHOLD, "nope"],
  ])("calls onSwipe when dragged %ipx", (distance, direction) => {
    const { onSwipe, card } = setup();

    drag(card, distance);
    finishExit();

    expect(onSwipe).toHaveBeenCalledExactlyOnceWith(direction);
  });

  it("follows the pointer while dragging and snaps back when released before the threshold", () => {
    const { onSwipe, card } = setup();

    fireEvent.pointerDown(card, { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(card, { clientX: 250, pointerId: 1 });
    expect(card.style.getPropertyValue("--drag-x")).toBe("50px");
    fireEvent.pointerUp(card, { clientX: 250, pointerId: 1 });
    finishExit();

    expect(onSwipe).not.toHaveBeenCalled();
    expect(card.style.getPropertyValue("--drag-x")).toBe("0px");
  });

  it.each([
    [160, "like", "8deg"],
    [-160, "nope", "-8deg"],
  ])(
    "leaves toward the swipe direction from where a %ipx drag was released",
    (distance, direction, rotate) => {
      const { card } = setup();

      drag(card, distance);

      expect(card).toHaveClass(`leaving-${direction}`);
      expect(card.style.getPropertyValue("--drag-x")).toBe(`${distance}px`);
      expect(card.style.getPropertyValue("--drag-rotate")).toBe(rotate);
    },
  );

  it("swipes only once when several swipes come in before the card has left", () => {
    const { onSwipe } = setup();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.click(screen.getByRole("button", { name: "Nope" }));
    finishExit();

    expect(onSwipe).toHaveBeenCalledExactlyOnceWith("like");
  });

  it("does nothing when disabled", () => {
    const { onSwipe, card } = setup(true);

    drag(card, SWIPE_THRESHOLD * 2);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    finishExit();

    expect(onSwipe).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Like" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Nope" })).toBeDisabled();
  });

  describe("stamps", () => {
    it("shows no stamp when the card is at rest", () => {
      setup();

      expect(likeStamp()).not.toBeVisible();
      expect(nopeStamp()).not.toBeVisible();
    });

    it.each([
      [40, "LIKE", "NOPE"],
      [-40, "NOPE", "LIKE"],
    ])("shows the matching stamp, growing with distance, when dragged %ipx", (distance, shown, hidden) => {
      const { card } = setup();

      fireEvent.pointerDown(card, { clientX: 200, pointerId: 1 });
      fireEvent.pointerMove(card, { clientX: 200 + distance, pointerId: 1 });
      expect(screen.getByText(shown)).toHaveStyle({ opacity: "0.4" });
      expect(screen.getByText(hidden)).not.toBeVisible();

      fireEvent.pointerMove(card, { clientX: 200 + distance * 5, pointerId: 1 });
      expect(screen.getByText(shown)).toHaveStyle({ opacity: "1" });
      expect(screen.getByText(hidden)).not.toBeVisible();
    });

    it("hides the stamp again when the card snaps back", () => {
      const { card } = setup();

      drag(card, SWIPE_THRESHOLD / 2);

      expect(likeStamp()).not.toBeVisible();
    });

    it.each([
      ["button", () => fireEvent.click(screen.getByRole("button", { name: "Like" })), "LIKE", "NOPE"],
      ["button", () => fireEvent.click(screen.getByRole("button", { name: "Nope" })), "NOPE", "LIKE"],
      ["key", () => fireEvent.keyDown(window, { key: "ArrowRight" }), "LIKE", "NOPE"],
      ["key", () => fireEvent.keyDown(window, { key: "ArrowLeft" }), "NOPE", "LIKE"],
    ])("shows the full stamp as the card leaves after a %s swipe (%#)", (_, swipe, shown, hidden) => {
      const { card } = setup();

      swipe();

      expect(screen.getByText(shown)).toHaveStyle({ opacity: "1" });
      expect(screen.getByText(hidden)).not.toBeVisible();
      expect(card).toHaveClass(`leaving-${shown.toLowerCase()}`);
    });

    it("shows no stamp tool at rest or while dragging", () => {
      const { card } = setup();
      expect(screen.queryByTestId("stamp-tool")).not.toBeInTheDocument();

      fireEvent.pointerDown(card, { clientX: 200, pointerId: 1 });
      fireEvent.pointerMove(card, { clientX: 200 + SWIPE_THRESHOLD * 2, pointerId: 1 });

      expect(screen.queryByTestId("stamp-tool")).not.toBeInTheDocument();
    });

    it.each([
      ["Like", "like"],
      ["Nope", "nope"],
    ])("brings down a decorative %s stamp tool when the swipe completes", (label, direction) => {
      setup();

      fireEvent.click(screen.getByRole("button", { name: label }));

      const tool = screen.getByTestId("stamp-tool");
      expect(tool).toHaveClass(`stamp-tool-${direction}`);
      expect(tool).toHaveAttribute("aria-hidden", "true");
    });

    it("keeps the full stamp after a drag swipe is released", () => {
      const { card } = setup();

      drag(card, -SWIPE_THRESHOLD);

      expect(nopeStamp()).toHaveStyle({ opacity: "1" });
      expect(likeStamp()).not.toBeVisible();
    });

    it("hides the stamps from screen readers", () => {
      setup();

      expect(likeStamp()).toHaveAttribute("aria-hidden", "true");
      expect(nopeStamp()).toHaveAttribute("aria-hidden", "true");
    });

    it("stays away until onSwipe settles, then comes back without a stamp if it is still shown", async () => {
      let settle: () => void = () => {};
      const { onSwipe, card } = setup();
      onSwipe.mockReturnValue(new Promise<void>((resolve) => (settle = resolve)));

      drag(card, 160);
      finishExit();
      expect(card).toHaveClass("leaving-like");
      await act(async () => settle());

      expect(card).not.toHaveClass("leaving-like");
      expect(card.style.getPropertyValue("--drag-x")).toBe("0px");
      expect(likeStamp()).not.toBeVisible();
      expect(screen.queryByTestId("stamp-tool")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Like" })).toBeEnabled();
    });
  });

  describe("entrance", () => {
    function setupEntering() {
      const onSwipe = vi.fn();
      render(<MemeCard meme={meme} onSwipe={onSwipe} enter />);
      return { onSwipe, card: screen.getByRole("img", { name: meme.caption }).closest("figure")! };
    }

    afterEach(() => vi.unstubAllGlobals());

    it("does not play without enter", () => {
      const { card } = setup();

      expect(card).not.toHaveClass("entering");
      expect(screen.getByRole("button", { name: "Like" })).toBeEnabled();
    });

    it("plays the entrance and ignores swipes until it is done", () => {
      const { onSwipe, card } = setupEntering();
      expect(card).toHaveClass("entering");
      expect(screen.getByRole("button", { name: "Like" })).toBeDisabled();

      fireEvent.keyDown(window, { key: "ArrowLeft" });
      drag(card, -SWIPE_THRESHOLD * 2);
      act(() => vi.advanceTimersByTime(CARD_ENTER_MS));
      expect(card).not.toHaveClass("entering");
      expect(onSwipe).not.toHaveBeenCalled();

      fireEvent.keyDown(window, { key: "ArrowRight" });
      finishExit();
      expect(onSwipe).toHaveBeenCalledExactlyOnceWith("like");
    });

    it("appears without animation and can be swiped right away with reduced motion", () => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn((query: string) => ({ matches: query === "(prefers-reduced-motion: reduce)", media: query })),
      );
      const { onSwipe, card } = setupEntering();

      expect(card).not.toHaveClass("entering");
      fireEvent.click(screen.getByRole("button", { name: "Like" }));
      finishExit();

      expect(onSwipe).toHaveBeenCalledExactlyOnceWith("like");
    });
  });
});
