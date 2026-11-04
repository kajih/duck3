import { randomInt, randomUUID } from "node:crypto";
import type { Profile, ProfileRepository } from "./repository.js";

/** The pictures a profile can have. A fixed list keeps them friendly and easy to validate. */
export const PROFILE_EMOJIS = [
  "🦦",
  "🐸",
  "🦊",
  "🐼",
  "🐙",
  "🦄",
  "🐝",
  "🦉",
  "🐧",
  "🐢",
  "🦖",
  "🐳",
  "🦔",
  "🐨",
  "🦁",
  "🐯",
  "🐵",
  "🐶",
  "🐱",
  "🦩",
  "🍕",
  "🌮",
  "🚀",
  "👾",
] as const;

export const NICKNAME_MAX_LENGTH = 24;

const ADJECTIVES = [
  "Giggling",
  "Sneaky",
  "Cosmic",
  "Sleepy",
  "Spicy",
  "Fluffy",
  "Wobbly",
  "Dramatic",
  "Turbo",
  "Chill",
];
const NOUNS = ["Otter", "Frog", "Fox", "Panda", "Octopus", "Unicorn", "Bee", "Owl", "Penguin", "Turtle"];

export class InvalidProfileError extends Error {}

export interface ProfileUpdate {
  nickname: unknown;
  emoji: unknown;
}

export interface ProfileService {
  /**
   * The user's profile. A user without one (new, or swiping since before profiles existed) gets a
   * generated nickname and emoji, so their swipes and likes simply carry on under the profile.
   */
  getProfile(userId: string): Profile;
  /** Changes nickname and emoji. Throws InvalidProfileError with a user-facing message for bad input. */
  updateProfile(userId: string, update: ProfileUpdate): Profile;
}

export interface ProfileServiceOptions {
  /** Returns a random integer in [0, max). Defaults to crypto.randomInt. */
  randomInt?: (max: number) => number;
  /** Creates a public profile id. Defaults to crypto.randomUUID. */
  createId?: () => string;
}

/** Trims and collapses whitespace, or throws InvalidProfileError. */
function validNickname(value: unknown): string {
  if (typeof value !== "string") throw new InvalidProfileError("Nickname is required");
  const nickname = value.trim().replace(/\s+/g, " ");
  if (!nickname) throw new InvalidProfileError("Nickname is required");
  if (/\p{Cc}/u.test(nickname)) throw new InvalidProfileError("Nickname contains invalid characters");
  if ([...nickname].length > NICKNAME_MAX_LENGTH) {
    throw new InvalidProfileError(`Nickname can be at most ${NICKNAME_MAX_LENGTH} characters`);
  }
  return nickname;
}

function validEmoji(value: unknown): string {
  const emoji = PROFILE_EMOJIS.find((choice) => choice === value);
  if (!emoji) throw new InvalidProfileError("Pick one of the profile pictures");
  return emoji;
}

export function createProfileService(
  repository: ProfileRepository,
  options: ProfileServiceOptions = {},
): ProfileService {
  const random = options.randomInt ?? ((max: number) => randomInt(max));
  const createId = options.createId ?? randomUUID;
  const pick = <T>(list: readonly T[]): T => list[random(list.length)];

  function getProfile(userId: string): Profile {
    const existing = repository.getByUser(userId);
    if (existing) return existing;
    const profile: Profile = {
      id: createId(),
      nickname: `${pick(ADJECTIVES)} ${pick(NOUNS)}`,
      emoji: pick(PROFILE_EMOJIS),
    };
    repository.save(userId, profile);
    return profile;
  }

  return {
    getProfile,

    updateProfile(userId, update) {
      const nickname = validNickname(update.nickname);
      const emoji = validEmoji(update.emoji);
      const profile = { ...getProfile(userId), nickname, emoji };
      repository.save(userId, profile);
      return profile;
    },
  };
}
