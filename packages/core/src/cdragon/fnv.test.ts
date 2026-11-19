import { expect, test } from "@playwright/test";
import { fnv1a32, hashedKey } from "./fnv";

const KNOWN_HASHES = [
  ["AFKDetection2", "e4460934"],
  ["ASSETS", "a2564d38"],
  ["AbilitiesData", "8b2e412d"],
] as const;

test.describe("fnv1a32", () => {
  for (const [name, hash] of KNOWN_HASHES) {
    test(`hashes ${name} like the CommunityDragon hash list`, () => {
      expect(fnv1a32(name)).toBe(hash);
    });
  }

  test("ignores letter case", () => {
    expect(fnv1a32("Health")).toBe(fnv1a32("health"));
  });

  test("formats hashed keys with braces", () => {
    expect(hashedKey("ASSETS")).toBe("{a2564d38}");
  });
});
