import { describe, expect, it } from "vitest";
import type { Direction } from "../src/api";
import { MILESTONE_SWIPES, NO_PROGRESS, STREAK_LENGTH, recordSwipe, type Celebration } from "../src/celebration";

/** Swipes in order and returns the celebration (or null) each swipe earned. */
function swipeAll(directions: Direction[]): (Celebration | null)[] {
  let progress = NO_PROGRESS;
  return directions.map((direction) => {
    const result = recordSwipe(progress, direction);
    progress = result.progress;
    return result.celebration;
  });
}

const likes = (n: number): Direction[] => Array<Direction>(n).fill("like");

describe("recordSwipe", () => {
  it("celebrates a streak on the like that completes it, and not before", () => {
    const results = swipeAll(likes(STREAK_LENGTH));

    expect(results.slice(0, -1).every((r) => r === null)).toBe(true);
    expect(results.at(-1)).toEqual({ kind: "streak", likes: STREAK_LENGTH });
  });

  it("resets the streak on a nope", () => {
    const results = swipeAll([...likes(STREAK_LENGTH - 1), "nope", ...likes(STREAK_LENGTH - 1)]);

    expect(results.every((r) => r === null)).toBe(true);
  });

  it("starts a new streak after a celebration", () => {
    const results = swipeAll(likes(STREAK_LENGTH * 2));

    expect(results.filter(Boolean)).toHaveLength(2);
    expect(results[STREAK_LENGTH * 2 - 1]).toEqual({ kind: "streak", likes: STREAK_LENGTH });
  });

  it("celebrates the 100th swipe once, even when every swipe is a nope", () => {
    const results = swipeAll(Array<Direction>(MILESTONE_SWIPES + 20).fill("nope"));

    expect(results.filter(Boolean)).toEqual([{ kind: "milestone", swipes: MILESTONE_SWIPES }]);
    expect(results[MILESTONE_SWIPES - 1]).not.toBeNull();
  });

  it("shows the milestone instead of a streak that ends on the 100th swipe", () => {
    const results = swipeAll([...Array<Direction>(MILESTONE_SWIPES - STREAK_LENGTH).fill("nope"), ...likes(STREAK_LENGTH)]);

    expect(results.at(-1)).toEqual({ kind: "milestone", swipes: MILESTONE_SWIPES });
  });
});
