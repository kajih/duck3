import { useCallback, useEffect, useState } from "react";
import {
  fetchLikes,
  fetchNextMeme,
  fetchTrending,
  resetSwipes,
  sendSwipe,
  type Direction,
  type Meme,
  type Trending,
} from "./api";
import { EmptyState } from "./EmptyState";
import { LikesView } from "./LikesView";
import { MemeCard } from "./MemeCard";
import { TrendingView } from "./TrendingView";

type View = "swipe" | "likes" | "trending";

export function App() {
  const [view, setView] = useState<View>("swipe");
  const [meme, setMeme] = useState<Meme | null>(null);
  const [likes, setLikes] = useState<Meme[] | null>(null);
  const [trending, setTrending] = useState<Trending | null>(null);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setMeme(await fetchNextMeme());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function showLikes() {
    setView("likes");
    setLikes(null);
    setError(null);
    try {
      setLikes(await fetchLikes());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function showTrending() {
    setView("trending");
    setTrending(null);
    setError(null);
    try {
      setTrending(await fetchTrending());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function showSwipe() {
    setView("swipe");
    await load();
  }

  async function swipe(direction: Direction) {
    if (!meme || swiping) return;
    setError(null);
    setSwiping(true);
    try {
      await sendSwipe(meme.id, direction);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSwiping(false);
    }
  }

  async function reset() {
    setError(null);
    try {
      await resetSwipes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return;
    }
    await load();
  }

  return (
    <main>
      <h1>Meme-Tinder</h1>
      <nav>
        <button type="button" aria-current={view === "swipe" ? "page" : undefined} onClick={showSwipe}>
          Swipe
        </button>
        <button type="button" aria-current={view === "likes" ? "page" : undefined} onClick={showLikes}>
          Likes
        </button>
        <button type="button" aria-current={view === "trending" ? "page" : undefined} onClick={showTrending}>
          Trending
        </button>
      </nav>
      {error && <p role="alert">Something went wrong: {error}. Is the backend running?</p>}
      {view === "likes" && !error && (likes ? <LikesView memes={likes} /> : <p>Loading…</p>)}
      {view === "trending" && !error && (trending ? <TrendingView trending={trending} /> : <p>Loading…</p>)}
      {view === "swipe" && loading && !error && <p>Loading…</p>}
      {view === "swipe" && !loading && !error && !meme && <EmptyState onReset={reset} />}
      {view === "swipe" && meme && (
        <MemeCard key={meme.id} meme={meme} onSwipe={swipe} disabled={swiping} />
      )}
    </main>
  );
}
