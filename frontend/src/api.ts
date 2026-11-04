import { getUserId } from "./identity";

/** How much people love a meme, across all users. */
export interface MemeStats {
  likes: number;
  swipes: number;
  /** Share of swipes that were likes (0-100), or null while the meme has too few swipes to tell. */
  likePercent: number | null;
}

export interface Meme {
  id: string;
  caption: string;
  imageUrl: string;
  stats: MemeStats;
}

export type Direction = "like" | "nope";

/** The time trending counts likes over: the last 24 hours, or all time when the last day was quiet. */
export type TrendingWindow = "last-24-hours" | "all-time";

export interface TrendingMeme extends Meme {
  /** Likes inside the trending window, which is what the ranking uses. */
  windowLikes: number;
}

export interface Trending {
  window: TrendingWindow;
  /** Most liked first. */
  memes: TrendingMeme[];
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...init.headers, "X-User-Id": getUserId() },
  });
  if (!res.ok) {
    let message = `Request failed (HTTP ${res.status})`;
    try {
      const body: unknown = await res.json();
      if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
        message = body.error;
      }
    } catch {
      // A proxy may return a non-JSON error; keep the HTTP status in that case.
    }
    throw new Error(message);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

/** Resolves to null when the user has swiped every meme. */
export async function fetchNextMeme(): Promise<Meme | null> {
  const { meme } = await request<{ meme: Meme | null }>("/api/memes/next");
  return meme;
}

export async function sendSwipe(memeId: string, direction: Direction): Promise<void> {
  await request("/api/swipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memeId, direction }),
  });
}

/** The memes the user has liked, in a stable order. */
export async function fetchLikes(): Promise<Meme[]> {
  const { memes } = await request<{ memes: Meme[] }>("/api/likes");
  return memes;
}

/** The memes people are loving right now, across all users. */
export async function fetchTrending(): Promise<Trending> {
  return request<Trending>("/api/trending");
}

/** Removes all of the user's swipes, including likes. */
export async function resetSwipes(): Promise<void> {
  await request("/api/swipes", { method: "DELETE" });
}

/** FileReader works in browsers and the test DOM, including browsers without File.text(). */
function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read this file. Please choose it again."));
    reader.onabort = () => reject(new Error("Reading the file was cancelled."));
    reader.readAsText(file, "UTF-8");
  });
}

export async function postMeme(file: File, caption: string): Promise<Meme> {
  const { meme } = await request<{ meme: Meme }>(`/api/memes?caption=${encodeURIComponent(caption.trim())}`, {
    method: "POST",
    headers: { "Content-Type": "image/svg+xml" },
    body: await readFile(file),
  });
  return meme;
}
