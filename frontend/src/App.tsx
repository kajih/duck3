import { useCallback, useEffect, useState } from "react";
import {
  fetchLikes,
  fetchNextMeme,
  fetchProfile,
  fetchTrending,
  resetSwipes,
  sendSwipe,
  updateProfile,
  type Direction,
  type Meme,
  type ProfileSettings,
  type Trending,
} from "./api";
import { CelebrationBurst } from "./CelebrationBurst";
import { NO_PROGRESS, recordSwipe, type Celebration, type SwipeProgress } from "./celebration";
import { EmptyState } from "./EmptyState";
import { LikesView } from "./LikesView";
import { MemeCard } from "./MemeCard";
import { ProfilePanel } from "./ProfilePanel";
import { TrendingView } from "./TrendingView";
import { PostMeme } from "./PostMeme";

type View = "swipe" | "likes" | "trending" | "post";

export function App() {
  const [view, setView] = useState<View>("swipe");
  const [meme, setMeme] = useState<Meme | null>(null);
  const [likes, setLikes] = useState<Meme[] | null>(null);
  const [trending, setTrending] = useState<Trending | null>(null);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  /** Whether the shown card follows a swipe, so it plays the entrance animation. */
  const [enterNext, setEnterNext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileSettings, setProfileSettings] = useState<ProfileSettings | null>(null);

  useEffect(() => {
    // The profile is a nice extra: without it (for example a failed request) the app still works.
    fetchProfile().then(setProfileSettings, () => {});
  }, []);

  async function saveProfile(nickname: string, emoji: string) {
    const profile = await updateProfile(nickname, emoji);
    setProfileSettings((settings) => settings && { ...settings, profile });
    return profile;
  }

  /** Swipes and the like streak in this session, for the celebrations. */
  const [progress, setProgress] = useState<SwipeProgress>(NO_PROGRESS);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const endCelebration = useCallback(() => setCelebration(null), []);

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
    setEnterNext(false);
    await load();
  }

  async function swipe(direction: Direction) {
    if (!meme || swiping) return;
    setError(null);
    setSwiping(true);
    try {
      await sendSwipe(meme.id, direction);
      const result = recordSwipe(progress, direction);
      setProgress(result.progress);
      if (result.celebration) setCelebration(result.celebration);
      setEnterNext(true);
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
    setEnterNext(false);
    setProgress(NO_PROGRESS);
    await load();
  }

  return (
    <main>
      <header className="app-header">
        <h1>Meme-Tinder</h1>
        {profileSettings && (
          <ProfilePanel key={profileSettings.profile.id} settings={profileSettings} onSave={saveProfile} />
        )}
      </header>
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
        <button
          type="button"
          aria-current={view === "post" ? "page" : undefined}
          onClick={() => {
            setError(null);
            setView("post");
          }}
        >
          Post
        </button>
      </nav>
      {view === "post" && <PostMeme />}
      {error && <p role="alert">Something went wrong: {error}. Is the backend running?</p>}
      {view === "likes" && !error && (likes ? <LikesView memes={likes} /> : <p>Loading…</p>)}
      {view === "trending" && !error && (trending ? <TrendingView trending={trending} /> : <p>Loading…</p>)}
      {view === "swipe" && loading && !error && <p>Loading…</p>}
      {view === "swipe" && !loading && !error && !meme && <EmptyState onReset={reset} />}
      {view === "swipe" && meme && (
        <MemeCard key={meme.id} meme={meme} onSwipe={swipe} disabled={swiping} enter={enterNext} />
      )}
      {celebration && <CelebrationBurst celebration={celebration} onDone={endCelebration} />}
    </main>
  );
}
