import { expect, test } from "@playwright/test";
import { decodeSegment, parseRiotId, riotPath } from "./riot-paths";

test("player path encodes spaces, unicode and dots", () => {
  expect(riotPath.player(" Mr. Đức ", "VN2")).toBe("/players/Mr%2E%20%C4%90%E1%BB%A9c/VN2");
  expect(decodeSegment("Mr%2E%20%C4%90%E1%BB%A9c")).toBe("Mr. Đức");
});

test("decodeSegment keeps malformed input", () => {
  expect(decodeSegment("%E0%A4%A")).toBe("%E0%A4%A");
});

test("leaderboard path omits the first page", () => {
  expect(riotPath.leaderboard()).toBe("/leaderboard");
  expect(riotPath.leaderboard(1)).toBe("/leaderboard");
  expect(riotPath.leaderboard(3)).toBe("/leaderboard?page=3");
});

test("parseRiotId trims both parts", () => {
  expect(parseRiotId("  Player One # VN2 ")).toEqual({ gameName: "Player One", tagLine: "VN2" });
  expect(parseRiotId("Đức Nguyễn#Đức")).toEqual({ gameName: "Đức Nguyễn", tagLine: "Đức" });
});

test("parseRiotId rejects invalid ids", () => {
  for (const input of [
    "",
    "NoTag",
    "#VN2",
    "ab#VN2",
    "Player#V",
    "A#B#VN2",
    "Player#TOOLONG",
    "A".repeat(17) + "#VN2",
  ]) {
    expect(parseRiotId(input)).toBeNull();
  }
});
