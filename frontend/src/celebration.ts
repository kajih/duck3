import type { Direction } from "./api";

/** How many likes in a row make a streak. */
export const STREAK_LENGTH = 5;

/** The swipe number that gets its own celebration. */
export const MILESTONE_SWIPES = 100;

export type Celebration = { kind: "streak"; likes: number } | { kind: "milestone"; swipes: number };

/** What the user has done in this session (since the page was loaded or the swipes were reset). */
export interface SwipeProgress {
  swipes: number;
  /** Likes in a row; goes back to 0 on a nope and after a streak celebration. */
  streak: number;
}

export const NO_PROGRESS: SwipeProgress = { swipes: 0, streak: 0 };

/**
 * Counts one more swipe and says whether it earns a celebration. The 100th swipe is celebrated
 * once, and wins over a streak that ends on the same swipe.
 */
export function recordSwipe(
  progress: SwipeProgress,
  direction: Direction,
): { progress: SwipeProgress; celebration: Celebration | null } {
  const swipes = progress.swipes + 1;
  const streak = direction === "like" ? progress.streak + 1 : 0;
  const streakDone = streak === STREAK_LENGTH;
  const next = { swipes, streak: streakDone ? 0 : streak };

  if (swipes === MILESTONE_SWIPES) return { progress: next, celebration: { kind: "milestone", swipes } };
  if (streakDone) return { progress: next, celebration: { kind: "streak", likes: STREAK_LENGTH } };
  return { progress: next, celebration: null };
}
