import type { Meme, MemeCatalog } from "../memes/catalog.js";
import type { Direction, Swipe, SwipeCounts, SwipeRepository } from "./repository.js";

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

/** Trending ranks memes by likes in the last TRENDING_WINDOW_HOURS hours... */
export const TRENDING_WINDOW_HOURS = 24;
/** ...unless that window has fewer swipes than this; then it ranks by likes of all time. */
export const MIN_SWIPES_FOR_TRENDING_WINDOW = 10;
/** How many memes trending lists at most. */
export const TRENDING_LIMIT = 10;

/** The time trending is counted over: the last TRENDING_WINDOW_HOURS hours, or all time as the fallback. */
export type TrendingWindow = "last-24-hours" | "all-time";

export interface TrendingMeme extends RatedMeme {
  /** Likes inside the trending window, which is what the ranking uses. `stats` stays all time. */
  windowLikes: number;
}

export interface Trending {
  window: TrendingWindow;
  /** Most liked first, at most TRENDING_LIMIT, only memes with at least one like in the window. */
  memes: TrendingMeme[];
}

export interface SwipeServiceOptions {
  /** Clock in milliseconds since the epoch, for the trending window. Defaults to Date.now. */
  now?: () => number;
}

export interface SwipeService {
  /** A catalog meme with up-to-date ratings, including already swiped memes. */
  getMeme(memeId: string): RatedMeme | null;
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
  /**
   * Moves the swipes of `fromUserId` to `toUserId` without duplicates: for a meme both swiped, the
   * swipe of `toUserId` is kept (the first swipe wins, as in recordSwipe). Used when a device joins a profile.
   */
  mergeSwipes(fromUserId: string, toUserId: string): void;
  /**
   * The memes people are loving right now: ranked by likes in the last TRENDING_WINDOW_HOURS hours,
   * then by the share of likes in that window, then in catalog order. Falls back to all time when
   * the window has fewer than MIN_SWIPES_FOR_TRENDING_WINDOW swipes.
   */
  listTrending(): Trending;
}

function totalSwipes(countsByMeme: Map<string, SwipeCounts>): number {
  let total = 0;
  for (const counts of countsByMeme.values()) total += counts.swipes;
  return total;
}

export function createSwipeService(
  catalog: MemeCatalog,
  repository: SwipeRepository,
  options: SwipeServiceOptions = {},
): SwipeService {
  const now = options.now ?? Date.now;

  function rate(meme: Meme): RatedMeme {
    const { likes, swipes } = repository.countByMeme(meme.id);
    const likePercent = swipes >= MIN_SWIPES_FOR_PERCENT ? Math.round((likes / swipes) * 100) : null;
    return { ...meme, stats: { likes, swipes, likePercent } };
  }

  return {
    getMeme(memeId) {
      const meme = catalog.getById(memeId);
      return meme ? rate(meme) : null;
    },
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

    mergeSwipes(fromUserId, toUserId) {
      repository.moveByUser(fromUserId, toUserId);
    },

    listTrending() {
      const windowStart = now() - TRENDING_WINDOW_HOURS * 60 * 60 * 1000;
      let window: TrendingWindow = "last-24-hours";
      let countsByMeme = repository.countAllByMemeSince(windowStart);
      if (totalSwipes(countsByMeme) < MIN_SWIPES_FOR_TRENDING_WINDOW) {
        window = "all-time";
        countsByMeme = repository.countAllByMemeSince(0);
      }

      const share = ({ likes, swipes }: SwipeCounts) => (swipes === 0 ? 0 : likes / swipes);
      const ranked = catalog
        .list()
        .map((meme, catalogIndex) => ({ meme, catalogIndex, counts: countsByMeme.get(meme.id) }))
        .filter((entry): entry is typeof entry & { counts: SwipeCounts } => (entry.counts?.likes ?? 0) > 0)
        .sort(
          (a, b) =>
            b.counts.likes - a.counts.likes ||
            share(b.counts) - share(a.counts) ||
            a.catalogIndex - b.catalogIndex,
        )
        .slice(0, TRENDING_LIMIT);

      return {
        window,
        memes: ranked.map(({ meme, counts }) => ({ ...rate(meme), windowLikes: counts.likes })),
      };
    },
  };
}
