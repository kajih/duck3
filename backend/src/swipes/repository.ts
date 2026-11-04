export type Direction = "like" | "nope";

export const DIRECTIONS: readonly Direction[] = ["like", "nope"];

export interface Swipe {
  memeId: string;
  direction: Direction;
}

/** How many users have swiped a meme, and how many of those swipes were likes. */
export interface SwipeCounts {
  likes: number;
  swipes: number;
}

/** Storage seam for swipes. The app uses the SQLite implementation (sqlite-repository.ts); tests use the in-memory one. */
export interface SwipeRepository {
  listByUser(userId: string): Swipe[];
  add(userId: string, swipe: Swipe): void;
  clearByUser(userId: string): void;
  /** Counts the swipes on a meme across all users. */
  countByMeme(memeId: string): SwipeCounts;
}

export function createInMemorySwipeRepository(): SwipeRepository {
  const swipesByUser = new Map<string, Swipe[]>();
  return {
    listByUser: (userId) => [...(swipesByUser.get(userId) ?? [])],
    add: (userId, swipe) => {
      swipesByUser.set(userId, [...(swipesByUser.get(userId) ?? []), swipe]);
    },
    clearByUser: (userId) => {
      swipesByUser.delete(userId);
    },
    countByMeme: (memeId) => {
      const counts: SwipeCounts = { likes: 0, swipes: 0 };
      for (const swipes of swipesByUser.values()) {
        for (const swipe of swipes) {
          if (swipe.memeId !== memeId) continue;
          counts.swipes += 1;
          if (swipe.direction === "like") counts.likes += 1;
        }
      }
      return counts;
    },
  };
}
