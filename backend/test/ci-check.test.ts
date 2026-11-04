import { expect, it } from "vitest";

// Deliberately failing, to verify that CI turns red (#3). Reverted right after.
it("fails on purpose", () => {
  expect(1).toBe(2);
});
