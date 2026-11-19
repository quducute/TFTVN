import { expect, test } from "@playwright/test";
import { matchStats, participantStats, patchForMatch, toStatView } from "./aggregate";
import match from "./fixtures/match.json" with { type: "json" };

const winner = {
  placement: 1,
  units: [
    { character_id: "Ahri", itemNames: ["Blade", "Blade"] },
    { character_id: "Ahri", itemNames: [] },
    { character_id: "Garen", itemNames: ["Vest"] },
  ],
  traits: [
    { name: "Mage", tier_current: 2 },
    { name: "Knight", tier_current: 0 },
  ],
};

test.describe("participantStats", () => {
  test("counts each champion, item and active trait once per board", () => {
    const rows = participantStats(winner);
    const find = (kind: string, apiName: string, variant = "") =>
      rows.find((row) => row.kind === kind && row.apiName === apiName && row.variant === variant);

    expect(find("champion", "Ahri")).toMatchObject({
      games: 1,
      placementSum: 1,
      top1Count: 1,
      top4Count: 1,
    });
    expect(find("item", "Blade")?.games).toBe(1);
    expect(find("item", "Blade", "Ahri")?.games).toBe(1);
    expect(find("item", "Vest", "Garen")).toBeDefined();
    expect(find("trait", "Mage")).toBeDefined();
    expect(find("trait", "Mage", "2")).toBeDefined();
    expect(find("trait", "Knight")).toBeUndefined();
  });

  test("marks bottom four placements correctly", () => {
    const rows = participantStats({ ...winner, placement: 6 });
    expect(
      rows.every((row) => row.top1Count === 0 && row.top4Count === 0 && row.placementSum === 6),
    ).toBe(true);
  });
});

test.describe("matchStats on a real match", () => {
  const rows = matchStats(match.info.participants);

  test("never counts a champion more often than there are players", () => {
    const champions = rows.filter((row) => row.kind === "champion" && row.variant === "");
    expect(champions.length).toBeGreaterThan(0);
    expect(Math.max(...champions.map((row) => row.games))).toBeLessThanOrEqual(8);
  });

  test("keeps placement sums consistent with game counts", () => {
    for (const row of rows) {
      expect(row.placementSum).toBeGreaterThanOrEqual(row.games);
      expect(row.placementSum).toBeLessThanOrEqual(row.games * 8);
      expect(row.top1Count).toBeLessThanOrEqual(1);
      expect(row.top4Count).toBeLessThanOrEqual(Math.min(row.games, 4));
    }
  });

  test("uses the real api names from the match", () => {
    expect(rows.some((row) => row.kind === "champion" && row.apiName.startsWith("DA_"))).toBe(true);
  });
});

test.describe("toStatView", () => {
  test("turns sums into rates", () => {
    expect(toStatView({ games: 4, placementSum: 10, top1Count: 1, top4Count: 3 }, 16)).toEqual({
      games: 4,
      pickRate: 0.25,
      averagePlacement: 2.5,
      top4Rate: 0.75,
      top1Rate: 0.25,
    });
  });

  test("does not divide by zero", () => {
    expect(toStatView({ games: 0, placementSum: 0, top1Count: 0, top4Count: 0 }, 0)).toMatchObject({
      pickRate: 0,
      averagePlacement: 0,
    });
  });
});

test.describe("patchForMatch", () => {
  const patches = [
    { id: "16.22", releasedAt: "2026-11-05T00:00:00Z" },
    { id: "16.23", releasedAt: "2026-11-18T00:00:00Z" },
  ];

  test("picks the latest patch released before the game", () => {
    expect(patchForMatch(patches, new Date("2026-11-19T10:00:00Z"))).toBe("16.23");
    expect(patchForMatch(patches, new Date("2026-11-10T10:00:00Z"))).toBe("16.22");
  });

  test("falls back to the oldest known patch for older games", () => {
    expect(patchForMatch(patches, new Date("2026-10-01T00:00:00Z"))).toBe("16.22");
  });

  test("returns null without patches", () => {
    expect(patchForMatch([], new Date())).toBeNull();
  });
});
