import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SwipesPerMinute } from "../src/SwipesPerMinute";

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, value: hidden });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  setHidden(false);
  vi.useRealTimers();
});

/** Lets pending promises settle and moves the clock. */
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe("SwipesPerMinute", () => {
  it("shows nothing until the first number arrives, then the number", async () => {
    let finish: (value: number) => void = () => {};
    render(<SwipesPerMinute load={() => new Promise((resolve) => (finish = resolve))} />);
    expect(screen.queryByText(/per minute/)).not.toBeInTheDocument();

    await act(async () => finish(12));

    expect(screen.getByText(/12 swipes per minute/)).toBeInTheDocument();
  });

  it("says 'swipe' for one", async () => {
    render(<SwipesPerMinute load={vi.fn().mockResolvedValue(1)} />);
    await advance(0);

    expect(screen.getByText(/1 swipe per minute/)).toBeInTheDocument();
  });

  it("updates every few seconds without a reload", async () => {
    const load = vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(7).mockResolvedValue(9);
    render(<SwipesPerMinute load={load} intervalMs={5000} />);
    await advance(0);
    expect(screen.getByText(/3 swipes/)).toBeInTheDocument();

    await advance(5000);
    expect(screen.getByText(/7 swipes/)).toBeInTheDocument();
    await advance(5000);
    expect(screen.getByText(/9 swipes/)).toBeInTheDocument();
  });

  it("stops asking while the tab is hidden and refreshes right away when it is visible again", async () => {
    const load = vi.fn().mockResolvedValue(4);
    render(<SwipesPerMinute load={load} intervalMs={5000} />);
    await advance(0);
    expect(load).toHaveBeenCalledTimes(1);

    setHidden(true);
    await advance(60_000);
    expect(load).toHaveBeenCalledTimes(1);

    setHidden(false);
    await advance(0);
    expect(load).toHaveBeenCalledTimes(2);
    await advance(5000);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("does not ask at all when it starts in a hidden tab", async () => {
    setHidden(true);
    const load = vi.fn().mockResolvedValue(4);
    render(<SwipesPerMinute load={load} intervalMs={5000} />);

    await advance(30_000);

    expect(load).not.toHaveBeenCalled();
  });

  it("keeps the last number when a refresh fails and recovers on the next one", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(5)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(6);
    render(<SwipesPerMinute load={load} intervalMs={5000} />);
    await advance(0);

    await advance(5000);
    expect(screen.getByText(/5 swipes/)).toBeInTheDocument();
    await advance(5000);
    expect(screen.getByText(/6 swipes/)).toBeInTheDocument();
  });

  it("stops asking after it is removed", async () => {
    const load = vi.fn().mockResolvedValue(4);
    const { unmount } = render(<SwipesPerMinute load={load} intervalMs={5000} />);
    await advance(0);

    unmount();
    await advance(60_000);

    expect(load).toHaveBeenCalledTimes(1);
  });
});
