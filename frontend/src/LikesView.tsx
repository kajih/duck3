import type { Meme } from "./api";
import { MemeRating } from "./MemeRating";

export function LikesView({ memes }: { memes: Meme[] }) {
  if (memes.length === 0) {
    return (
      <section className="likes-view">
        <h2>Your likes</h2>
        <p>You have not liked any memes yet.</p>
      </section>
    );
  }
  return (
    <section className="likes-view">
      <h2>Your likes</h2>
      <ul>
        {memes.map((meme) => (
          <li key={meme.id}>
            <figure className="meme-card">
              <img src={meme.imageUrl} alt={meme.caption} />
              <figcaption>
                <span>{meme.caption}</span>
                <MemeRating stats={meme.stats} />
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
