import type { Trending } from "./api";
import { MemeRating } from "./MemeRating";

const WINDOW_TEXT: Record<Trending["window"], { subtitle: string; likesSuffix: string }> = {
  "last-24-hours": { subtitle: "Most liked in the last 24 hours", likesSuffix: "today" },
  "all-time": { subtitle: "A quiet day, so: most liked of all time", likesSuffix: "all time" },
};

/** The memes people are loving right now, ranked with the most liked first. */
export function TrendingView({ trending }: { trending: Trending }) {
  const text = WINDOW_TEXT[trending.window];
  return (
    <section className="trending-view" aria-labelledby="trending-heading">
      <h2 id="trending-heading">Trending</h2>
      <p className="trending-window">{text.subtitle}</p>
      {trending.memes.length === 0 ? (
        <p className="trending-empty">Nothing is trending yet. Go swipe some memes and start a trend!</p>
      ) : (
        <ol>
          {trending.memes.map((meme, index) => (
            <li key={meme.id} className={index < 3 ? `trending-top trending-top-${index + 1}` : undefined}>
              <span className="trending-rank" aria-hidden="true">
                {index + 1}
              </span>
              <img src={meme.imageUrl} alt={meme.caption} />
              <div className="trending-details">
                <span className="trending-caption">{meme.caption}</span>
                <span className="trending-likes">
                  {meme.windowLikes} {meme.windowLikes === 1 ? "like" : "likes"} {text.likesSuffix}
                </span>
                <MemeRating stats={meme.stats} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
