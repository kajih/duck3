/** A user's public face. `id` is the public profile id; the secret user id is never part of it. */
export interface Profile {
  id: string;
  nickname: string;
  emoji: string;
}

/** Storage seam for profiles, keyed by the secret user id. The app uses SQLite; tests use the in-memory one. */
export interface ProfileRepository {
  getByUser(userId: string): Profile | undefined;
  /** Creates the user's profile, or replaces it. The public id must not change once created. */
  save(userId: string, profile: Profile): void;
}

export function createInMemoryProfileRepository(): ProfileRepository {
  const profilesByUser = new Map<string, Profile>();
  return {
    getByUser: (userId) => {
      const profile = profilesByUser.get(userId);
      return profile && { ...profile };
    },
    save: (userId, profile) => {
      profilesByUser.set(userId, { ...profile });
    },
  };
}
