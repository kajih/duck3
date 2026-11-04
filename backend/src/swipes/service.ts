import type { Meme, MemeCatalog } from "../memes/catalog.js";
import type { Direction, Swipe, SwipeRepository } from "./repository.js";

export class UnknownMemeError extends Error {
  constructor(memeId: string) {
    super(`Unknown meme id: ${memeId}`);
  }
}

/** Below this many swipes a like percentage is too noisy to show, so likePercent is null ("new meme"). */
export const MIN_SWIPES_FOR_PERCENT = 5;

/** How much people love a meme, across all users. */
export interface MemeStats {
  likes: number;
  swipes: number;
  /** Rounded share of swipes that were likes (0-100), or null below MIN_SWIPES_FOR_PERCENT swipes. */
  likePercent: number | null;
}

export interface RatedMeme extends Meme {
  stats: MemeStats;
}

export interface SwipeService {
  /** The next meme the user has not swiped yet, or null when all memes have been swiped. */
  getNextMeme(userId: string): RatedMeme | null;
  /**
   * Records a swipe. Swiping the same meme again is idempotent: the first swipe is kept
   * and returned. Throws UnknownMemeError if the meme does not exist.
   */
  recordSwipe(userId: string, memeId: string, direction: Direction): Swipe;
  /** The memes the user has liked, in catalog order (a stable order that does not depend on the repository). */
  listLikedMemes(userId: string): RatedMeme[];
  /** Removes all of the user's swipes, including likes. Safe to call repeatedly. */
  resetSwipes(userId: string): void;
}

export function createSwipeService(catalog: MemeCatalog, repository: SwipeRepository): SwipeService {
  function rate(meme: Meme): RatedMeme {
    const { likes, swipes } = repository.countByMeme(meme.id);
    const likePercent = swipes >= MIN_SWIPES_FOR_PERCENT ? Math.round((likes / swipes) * 100) : null;
    return { ...meme, stats: { likes, swipes, likePercent } };
  }

  return {
    getNextMeme(userId) {
      const seen = new Set(repository.listByUser(userId).map((swipe) => swipe.memeId));
      const meme = catalog.list().find((meme) => !seen.has(meme.id));
      return meme ? rate(meme) : null;
    },

    recordSwipe(userId, memeId, direction) {
      if (!catalog.getById(memeId)) throw new UnknownMemeError(memeId);
      const existing = repository.listByUser(userId).find((swipe) => swipe.memeId === memeId);
      if (existing) return existing;
      const swipe = { memeId, direction };
      repository.add(userId, swipe);
      return swipe;
    },

    listLikedMemes(userId) {
      const liked = new Set(
        repository
          .listByUser(userId)
          .filter((swipe) => swipe.direction === "like")
          .map((swipe) => swipe.memeId),
      );
      return catalog
        .list()
        .filter((meme) => liked.has(meme.id))
        .map(rate);
    },

    resetSwipes(userId) {
      repository.clearByUser(userId);
    },
  };
}
