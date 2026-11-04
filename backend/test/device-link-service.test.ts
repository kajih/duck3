import { describe, expect, it } from "vitest";
import {
  ATTEMPT_WINDOW_MS,
  createDeviceLinkService,
  InvalidLinkCodeError,
  LINK_CODE_ALPHABET,
  LINK_CODE_LENGTH,
  LINK_CODE_TTL_MS,
  MAX_FAILED_ATTEMPTS,
  TooManyAttemptsError,
} from "../src/devices/service.js";
import { createMemeCatalog } from "../src/memes/catalog.js";
import { createInMemoryProfileRepository } from "../src/profiles/repository.js";
import { createProfileService } from "../src/profiles/service.js";
import { createInMemorySwipeRepository } from "../src/swipes/repository.js";
import { createSwipeService } from "../src/swipes/service.js";

function setup() {
  let time = 1_000_000;
  const swipes = createSwipeService(
    createMemeCatalog([
      { id: "a", caption: "A", file: "a.svg" },
      { id: "b", caption: "B", file: "b.svg" },
      { id: "c", caption: "C", file: "c.svg" },
    ]),
    createInMemorySwipeRepository(),
  );
  const profiles = createProfileService(createInMemoryProfileRepository());
  const devices = createDeviceLinkService({ swipes, profiles }, { now: () => time });
  return { swipes, profiles, devices, advance: (ms: number) => (time += ms) };
}

const attempt = "198.51.100.7";

describe("device link service", () => {
  it("makes a code from easy-to-read characters that expires after a few minutes", () => {
    const link = setup().devices.createLink("phone");

    expect(link.code).toMatch(new RegExp(`^[${LINK_CODE_ALPHABET}]{${LINK_CODE_LENGTH / 2}}-[${LINK_CODE_ALPHABET}]{${LINK_CODE_LENGTH / 2}}$`));
    expect(link.expiresInSeconds).toBe(LINK_CODE_TTL_MS / 1000);
    expect(LINK_CODE_TTL_MS).toBeLessThanOrEqual(10 * 60 * 1000);
  });

  it("makes a different code every time", () => {
    const { devices } = setup();
    const codes = new Set(Array.from({ length: 50 }, (_, i) => devices.createLink(`user-${i}`).code));

    expect(codes.size).toBe(50);
  });

  it("gives the new device the profile's user id", () => {
    const { devices } = setup();
    const { code } = devices.createLink("phone");

    expect(devices.redeem("laptop", code, attempt)).toEqual({ userId: "phone" });
  });

  it("accepts the code in lower case and without the dash", () => {
    const { devices } = setup();
    const { code } = devices.createLink("phone");

    expect(devices.redeem("laptop", code.replace("-", " ").toLowerCase(), attempt)).toEqual({ userId: "phone" });
  });

  it("works only once", () => {
    const { devices } = setup();
    const { code } = devices.createLink("phone");
    devices.redeem("laptop", code, attempt);

    expect(() => devices.redeem("tablet", code, attempt)).toThrow(InvalidLinkCodeError);
  });

  it("does not work after it expired", () => {
    const { devices, advance } = setup();
    const { code } = devices.createLink("phone");

    advance(LINK_CODE_TTL_MS);

    expect(() => devices.redeem("laptop", code, attempt)).toThrow(InvalidLinkCodeError);
  });

  it("still works just before it expires", () => {
    const { devices, advance } = setup();
    const { code } = devices.createLink("phone");

    advance(LINK_CODE_TTL_MS - 1);

    expect(devices.redeem("laptop", code, attempt)).toEqual({ userId: "phone" });
  });

  it("rejects an unknown code with a friendly message", () => {
    expect(() => setup().devices.redeem("laptop", "AAAA-AAAA", attempt)).toThrow(/used or expired/);
  });

  it("replaces the user's earlier code when they ask for a new one", () => {
    const { devices } = setup();
    const first = devices.createLink("phone");
    const second = devices.createLink("phone");

    expect(() => devices.redeem("laptop", first.code, attempt)).toThrow(InvalidLinkCodeError);
    expect(devices.redeem("laptop", second.code, attempt)).toEqual({ userId: "phone" });
  });

  it("merges the new device's anonymous swipes into the profile without duplicates", () => {
    const { devices, swipes } = setup();
    swipes.recordSwipe("phone", "a", "nope");
    swipes.recordSwipe("laptop", "a", "like");
    swipes.recordSwipe("laptop", "b", "like");
    const { code } = devices.createLink("phone");

    const { userId } = devices.redeem("laptop", code, attempt);

    expect(userId).toBe("phone");
    expect(swipes.listLikedMemes("phone").map((meme) => meme.id)).toEqual(["b"]);
    expect(swipes.getNextMeme("phone")?.id).toBe("c");
    expect(swipes.getNextMeme("laptop")?.id).toBe("a");
  });

  it("drops the new device's own profile, and keeps the profile it joined", () => {
    const { devices, profiles } = setup();
    const phone = profiles.getProfile("phone");
    const laptop = profiles.getProfile("laptop");
    const { code } = devices.createLink("phone");

    devices.redeem("laptop", code, attempt);

    expect(profiles.getProfile("phone")).toEqual(phone);
    expect(profiles.getProfile("laptop").id).not.toBe(laptop.id);
  });

  it("uses the code up without changing anything when a device redeems its own code", () => {
    const { devices, swipes } = setup();
    swipes.recordSwipe("phone", "a", "like");
    const { code } = devices.createLink("phone");

    expect(devices.redeem("phone", code, attempt)).toEqual({ userId: "phone" });
    expect(swipes.listLikedMemes("phone")).toHaveLength(1);
    expect(() => devices.redeem("laptop", code, attempt)).toThrow(InvalidLinkCodeError);
  });

  describe("rate limit", () => {
    function failTimes(devices: ReturnType<typeof setup>["devices"], times: number) {
      for (let i = 0; i < times; i++) expect(() => devices.redeem("laptop", "AAAA-AAAA", attempt)).toThrow(InvalidLinkCodeError);
    }

    it("refuses a caller after too many wrong codes, even for the right code", () => {
      const { devices } = setup();
      const { code } = devices.createLink("phone");
      failTimes(devices, MAX_FAILED_ATTEMPTS);

      expect(() => devices.redeem("laptop", code, attempt)).toThrow(TooManyAttemptsError);
    });

    it("tells how long to wait", () => {
      const { devices } = setup();
      failTimes(devices, MAX_FAILED_ATTEMPTS);

      expect(() => devices.redeem("laptop", "AAAA-AAAA", attempt)).toThrow(
        expect.objectContaining({ retryAfterSeconds: ATTEMPT_WINDOW_MS / 1000 }),
      );
    });

    it("lets the caller try again once the window has passed", () => {
      const { devices, advance } = setup();
      failTimes(devices, MAX_FAILED_ATTEMPTS);

      advance(ATTEMPT_WINDOW_MS + 1);
      const { code } = devices.createLink("phone");

      expect(devices.redeem("laptop", code, attempt)).toEqual({ userId: "phone" });
    });

    it("does not block other callers", () => {
      const { devices } = setup();
      const { code } = devices.createLink("phone");
      failTimes(devices, MAX_FAILED_ATTEMPTS);

      expect(devices.redeem("laptop", code, "203.0.113.9")).toEqual({ userId: "phone" });
    });

    it("does not count right codes", () => {
      const { devices } = setup();
      for (let i = 0; i < MAX_FAILED_ATTEMPTS + 2; i++) {
        expect(devices.redeem(`device-${i}`, devices.createLink(`owner-${i}`).code, attempt)).toEqual({ userId: `owner-${i}` });
      }
    });
  });
});
