import { randomInt } from "node:crypto";
import type { ProfileService } from "../profiles/service.js";
import type { SwipeService } from "../swipes/service.js";

/** How long a link code works. */
export const LINK_CODE_TTL_MS = 5 * 60 * 1000;
/** Letters and digits without look-alikes (no I, L, O, 0, 1), so a code is easy to type from a screen. */
export const LINK_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** 31^8 is about 8.5e11 codes; together with the rate limit and the short life that is hard to guess. */
export const LINK_CODE_LENGTH = 8;
/** A caller may fail this many times within ATTEMPT_WINDOW_MS before being refused for a while. */
export const MAX_FAILED_ATTEMPTS = 10;
export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/** The code is unknown, already used or expired. One error for all three, so guessing learns nothing. */
export class InvalidLinkCodeError extends Error {
  constructor() {
    super(
      "That code does not work. It may have been used or expired. Ask for a new one on your other device.",
    );
  }
}

export class TooManyAttemptsError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Too many wrong codes. Wait a few minutes and try again.");
  }
}

export interface DeviceLink {
  /** Shown as two groups, for example "K7QM-4TXD". Works with or without the dash, in any case. */
  code: string;
  /** Milliseconds since the epoch. */
  expiresAt: number;
  expiresInSeconds: number;
}

export interface DeviceLinkService {
  /** Makes a one-time code for the user's profile. A new code replaces the user's earlier unused one. */
  createLink(userId: string): DeviceLink;
  /**
   * Joins the device behind `newUserId` to the profile that made the code. The device's anonymous swipes
   * move into that profile (its own swipe wins for a meme both swiped) and its own profile is dropped.
   * Resolves to the user id the device must use from now on. The code is used up.
   * `attemptKey` identifies the caller (an IP address) for the rate limit on wrong codes.
   * Throws InvalidLinkCodeError or TooManyAttemptsError.
   */
  redeem(newUserId: string, code: string, attemptKey: string): { userId: string };
}

export interface DeviceLinkServiceOptions {
  /** Clock in milliseconds since the epoch. Defaults to Date.now. */
  now?: () => number;
  /** Returns a random integer in [0, max). Defaults to crypto.randomInt. */
  randomInt?: (max: number) => number;
}

/** Drops case, dashes, spaces and anything else that is not part of a code. */
function normalize(code: string): string {
  return [...code.toUpperCase()].filter((char) => LINK_CODE_ALPHABET.includes(char)).join("");
}

/**
 * Codes live in memory: they last minutes, so losing them on a restart only means asking for a new one.
 * This assumes a single backend process, as the app runs today.
 */
export function createDeviceLinkService(
  dependencies: { swipes: SwipeService; profiles: ProfileService },
  options: DeviceLinkServiceOptions = {},
): DeviceLinkService {
  const now = options.now ?? Date.now;
  const random = options.randomInt ?? ((max: number) => randomInt(max));

  const ownerByCode = new Map<string, { userId: string; expiresAt: number }>();
  const codeByOwner = new Map<string, string>();
  const failuresByCaller = new Map<string, number[]>();

  function forget(code: string) {
    const entry = ownerByCode.get(code);
    if (!entry) return;
    ownerByCode.delete(code);
    if (codeByOwner.get(entry.userId) === code) codeByOwner.delete(entry.userId);
  }

  function dropExpired() {
    for (const [code, entry] of ownerByCode) if (entry.expiresAt <= now()) forget(code);
  }

  /** The failures of one caller that still count, oldest first. */
  function recentFailures(attemptKey: string): number[] {
    const recent = (failuresByCaller.get(attemptKey) ?? []).filter(
      (time) => time > now() - ATTEMPT_WINDOW_MS,
    );
    if (recent.length > 0) failuresByCaller.set(attemptKey, recent);
    else failuresByCaller.delete(attemptKey);
    return recent;
  }

  function recordFailure(attemptKey: string) {
    failuresByCaller.set(attemptKey, [...recentFailures(attemptKey), now()]);
    // Callers that stopped guessing should not stay in memory forever.
    if (failuresByCaller.size > 1000) for (const key of [...failuresByCaller.keys()]) recentFailures(key);
  }

  function newCode(): string {
    for (;;) {
      const code = Array.from(
        { length: LINK_CODE_LENGTH },
        () => LINK_CODE_ALPHABET[random(LINK_CODE_ALPHABET.length)],
      ).join("");
      if (!ownerByCode.has(code)) return code;
    }
  }

  return {
    createLink(userId) {
      dropExpired();
      const earlier = codeByOwner.get(userId);
      if (earlier) forget(earlier);
      const code = newCode();
      const expiresAt = now() + LINK_CODE_TTL_MS;
      ownerByCode.set(code, { userId, expiresAt });
      codeByOwner.set(userId, code);
      return {
        code: `${code.slice(0, LINK_CODE_LENGTH / 2)}-${code.slice(LINK_CODE_LENGTH / 2)}`,
        expiresAt,
        expiresInSeconds: LINK_CODE_TTL_MS / 1000,
      };
    },

    redeem(newUserId, code, attemptKey) {
      const failures = recentFailures(attemptKey);
      if (failures.length >= MAX_FAILED_ATTEMPTS) {
        throw new TooManyAttemptsError(Math.ceil((failures[0] + ATTEMPT_WINDOW_MS - now()) / 1000));
      }

      const key = normalize(code);
      const entry = ownerByCode.get(key);
      if (!entry || entry.expiresAt <= now()) {
        forget(key);
        recordFailure(attemptKey);
        throw new InvalidLinkCodeError();
      }

      forget(key);
      if (newUserId !== entry.userId) {
        // The joining device no longer has a profile of its own, so any code it made is moot too.
        const own = codeByOwner.get(newUserId);
        if (own) forget(own);
        dependencies.swipes.mergeSwipes(newUserId, entry.userId);
        dependencies.profiles.discardProfile(newUserId);
      }
      return { userId: entry.userId };
    },
  };
}
