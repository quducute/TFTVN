import { describe, expect, it } from "vitest";
import { fnv1a32, hashedKey } from "./fnv";

describe("fnv1a32", () => {
  it.each([
    ["AFKDetection2", "e4460934"],
    ["ASSETS", "a2564d38"],
    ["AbilitiesData", "8b2e412d"],
  ])("hashes %s like the CommunityDragon hash list", (name, hash) => {
    expect(fnv1a32(name)).toBe(hash);
  });

  it("ignores letter case", () => {
    expect(fnv1a32("Health")).toBe(fnv1a32("health"));
  });

  it("formats hashed keys with braces", () => {
    expect(hashedKey("ASSETS")).toBe("{a2564d38}");
  });
});
