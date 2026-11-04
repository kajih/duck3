import type { MemeStats } from "./api";

/** How much people love a meme, for example "87% of people loved this", or "New meme" without enough swipes. */
export function MemeRating({ stats }: { stats: MemeStats }) {
  return (
    <span className="meme-rating">
      {stats.likePercent === null ? "New meme" : `${stats.likePercent}% of people loved this`}
    </span>
  );
}
