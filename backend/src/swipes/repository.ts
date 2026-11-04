export type Direction = "like" | "nope";

export const DIRECTIONS: readonly Direction[] = ["like", "nope"];

export interface Swipe {
  memeId: string;
  direction: Direction;
}

/** Storage seam for swipes. The app uses the SQLite implementation (sqlite-repository.ts); tests use the in-memory one. */
export interface SwipeRepository {
  listByUser(userId: string): Swipe[];
  add(userId: string, swipe: Swipe): void;
  clearByUser(userId: string): void;
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
  };
}
