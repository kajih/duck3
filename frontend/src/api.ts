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

/** A user's public face. `id` is the public profile id, which is safe to show to other people. */
export interface Profile {
  id: string;
  nickname: string;
  emoji: string;
}

export interface ProfileSettings {
  profile: Profile;
  /** The profile pictures to choose from. */
  emojiChoices: string[];
  nicknameMaxLength: number;
}

/** A failed request. `serverMessage` is the API's user-facing `error`, when it sent one. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly serverMessage?: string,
  ) {
    super(`Request failed (HTTP ${status})`);
  }
}

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
    let serverMessage: string | undefined;
    try {
      const body: unknown = await res.json();
      if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
        serverMessage = body.error;
      }
    } catch {
      // No JSON error body.
    }
    throw new ApiError(res.status, serverMessage);
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

/** The user's profile (created with a generated nickname and emoji on first use) and what it may be changed to. */
export async function fetchProfile(): Promise<ProfileSettings> {
  return request<ProfileSettings>("/api/profile");
}

/** Changes nickname and emoji. Rejects with an ApiError whose serverMessage explains invalid input. */
export async function updateProfile(nickname: string, emoji: string): Promise<Profile> {
  const { profile } = await request<{ profile: Profile }>("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, emoji }),
  });
  return profile;
}

/** Removes all of the user's swipes, including likes. */
export async function resetSwipes(): Promise<void> {
  await request("/api/swipes", { method: "DELETE" });
}
