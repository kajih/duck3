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
  /**
   * Moves all swipes of `fromUserId` to `toUserId`, keeping their swipe times. For a meme both users
   * swiped, the target's swipe wins and the source's is dropped. Afterwards `fromUserId` has no swipes.
   */
  moveByUser(fromUserId: string, toUserId: string): void;
  /** Counts the swipes on a meme across all users. */
  countByMeme(memeId: string): SwipeCounts;
  /**
   * Counts the swipes per meme across all users, only for swipes made at or after `since`
   * (milliseconds since the epoch). Memes without swipes in that time are left out.
   */
  countAllByMemeSince(since: number): Map<string, SwipeCounts>;
}

export interface SwipeRepositoryOptions {
  /** Clock for the stored swipe time, in milliseconds since the epoch. Defaults to Date.now. */
  now?: () => number;
}

interface StoredSwipe extends Swipe {
  swipedAt: number;
}

export function createInMemorySwipeRepository(options: SwipeRepositoryOptions = {}): SwipeRepository {
  const now = options.now ?? Date.now;
  const swipesByUser = new Map<string, StoredSwipe[]>();
  return {
    listByUser: (userId) =>
      (swipesByUser.get(userId) ?? []).map(({ memeId, direction }): Swipe => ({ memeId, direction })),
    add: (userId, swipe) => {
      const stored: StoredSwipe = { memeId: swipe.memeId, direction: swipe.direction, swipedAt: now() };
      swipesByUser.set(userId, [...(swipesByUser.get(userId) ?? []), stored]);
    },
    clearByUser: (userId) => {
      swipesByUser.delete(userId);
    },
    moveByUser: (fromUserId, toUserId) => {
      if (fromUserId === toUserId) return;
      const source = swipesByUser.get(fromUserId) ?? [];
      const target = swipesByUser.get(toUserId) ?? [];
      const taken = new Set(target.map((swipe) => swipe.memeId));
      swipesByUser.delete(fromUserId);
      if (source.length === 0) return;
      swipesByUser.set(toUserId, [...target, ...source.filter((swipe) => !taken.has(swipe.memeId))]);
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
    countAllByMemeSince: (since) => {
      const countsByMeme = new Map<string, SwipeCounts>();
      for (const swipes of swipesByUser.values()) {
        for (const swipe of swipes) {
          if (swipe.swipedAt < since) continue;
          const counts = countsByMeme.get(swipe.memeId) ?? { likes: 0, swipes: 0 };
          counts.swipes += 1;
          if (swipe.direction === "like") counts.likes += 1;
          countsByMeme.set(swipe.memeId, counts);
        }
      }
      return countsByMeme;
    },
  };
}
