import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CELEBRATION_MS, CelebrationBurst } from "../src/CelebrationBurst";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("CelebrationBurst", () => {
  it("announces a streak politely, with confetti hidden from screen readers", () => {
    const { container } = render(<CelebrationBurst celebration={{ kind: "streak", likes: 5 }} onDone={vi.fn()} />);

    expect(screen.getByRole("status")).toHaveTextContent("5 likes in a row!");
    expect(container.querySelector(".confetti")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll(".confetti span").length).toBeGreaterThan(0);
  });

  it("shows a distinct message for the 100th swipe", () => {
    const { container } = render(<CelebrationBurst celebration={{ kind: "milestone", swipes: 100 }} onDone={vi.fn()} />);

    expect(screen.getByRole("status")).toHaveTextContent("100 swipes!");
    expect(container.firstChild).toHaveClass("celebration-milestone");
  });

  it("is done after CELEBRATION_MS and has no focusable content", () => {
    const onDone = vi.fn();
    const { container } = render(<CelebrationBurst celebration={{ kind: "streak", likes: 5 }} onDone={onDone} />);

    expect(container.querySelector("button, a, input, [tabindex]")).toBeNull();
    act(() => vi.advanceTimersByTime(CELEBRATION_MS - 1));
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalledOnce();
  });
});
