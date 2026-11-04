import { describe, expect, it } from "vitest";
import { createInMemoryProfileRepository } from "../src/profiles/repository.js";
import {
  createProfileService,
  InvalidProfileError,
  NICKNAME_MAX_LENGTH,
  PROFILE_EMOJIS,
} from "../src/profiles/service.js";

function setup() {
  let nextId = 0;
  return createProfileService(createInMemoryProfileRepository(), {
    randomInt: () => 0,
    createId: () => `public-${++nextId}`,
  });
}

describe("profile service", () => {
  it("gives a user without a profile a generated nickname and emoji", () => {
    const profile = setup().getProfile("u1");

    expect(profile).toEqual({
      id: "public-1",
      nickname: expect.stringMatching(/^\S+ \S+$/),
      emoji: PROFILE_EMOJIS[0],
    });
  });

  it("keeps the same profile, including the public id, on later calls", () => {
    const service = setup();
    const first = service.getProfile("u1");

    expect(service.getProfile("u1")).toEqual(first);
  });

  it("gives each user their own public id, which is not the user id", () => {
    const service = setup();

    const a = service.getProfile("u1");
    const b = service.getProfile("u2");

    expect(a.id).not.toBe(b.id);
    expect([a.id, b.id]).not.toContain("u1");
    expect(Object.values(a)).not.toContain("u1");
  });

  it("generates varied nicknames and emojis", () => {
    let call = 0;
    const service = createProfileService(createInMemoryProfileRepository(), {
      randomInt: (max) => call++ % max,
    });

    const nicknames = new Set(["u1", "u2", "u3"].map((user) => service.getProfile(user).nickname));

    expect(nicknames.size).toBe(3);
  });

  it("updates nickname and emoji and keeps the public id", () => {
    const service = setup();
    const { id } = service.getProfile("u1");

    const updated = service.updateProfile("u1", { nickname: "Meme Queen", emoji: "🦄" });

    expect(updated).toEqual({ id, nickname: "Meme Queen", emoji: "🦄" });
    expect(service.getProfile("u1")).toEqual(updated);
  });

  it("creates the profile when a new user updates it straight away", () => {
    const service = setup();

    expect(service.updateProfile("u1", { nickname: "Fresh", emoji: "🐸" })).toEqual({
      id: "public-1",
      nickname: "Fresh",
      emoji: "🐸",
    });
  });

  it("trims and collapses whitespace in the nickname", () => {
    expect(setup().updateProfile("u1", { nickname: "  Meme   Queen ", emoji: "🦄" }).nickname).toBe(
      "Meme Queen",
    );
  });

  it("accepts a nickname of the maximum length, counting emoji as one character", () => {
    const nickname = "🐸".repeat(NICKNAME_MAX_LENGTH);

    expect(setup().updateProfile("u1", { nickname, emoji: "🐸" }).nickname).toBe(nickname);
  });

  it.each([
    ["missing", undefined, "Nickname is required"],
    ["empty", "   ", "Nickname is required"],
    ["not text", 42, "Nickname is required"],
    ["too long", "x".repeat(NICKNAME_MAX_LENGTH + 1), `at most ${NICKNAME_MAX_LENGTH} characters`],
    ["with control characters", "Meme\u0000Queen", "invalid characters"],
  ])("rejects a %s nickname", (_case, nickname, message) => {
    const service = setup();

    expect(() => service.updateProfile("u1", { nickname, emoji: "🦄" })).toThrow(InvalidProfileError);
    expect(() => service.updateProfile("u1", { nickname, emoji: "🦄" })).toThrow(message);
  });

  it.each([
    ["missing", undefined],
    ["not in the list", "💩"],
    ["text", "otter"],
  ])("rejects an emoji that is %s", (_case, emoji) => {
    expect(() => setup().updateProfile("u1", { nickname: "Meme Queen", emoji })).toThrow(
      "Pick one of the profile pictures",
    );
  });

  it("does not change the profile when an update is rejected", () => {
    const service = setup();
    const before = service.getProfile("u1");

    expect(() => service.updateProfile("u1", { nickname: "", emoji: "🦄" })).toThrow();

    expect(service.getProfile("u1")).toEqual(before);
  });

  it("discards a profile, and a later call creates a new one with a new public id", () => {
    const service = setup();
    const first = service.getProfile("u1");

    service.discardProfile("u1");

    expect(service.getProfile("u1").id).not.toBe(first.id);
  });
});
