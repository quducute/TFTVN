import { expect, test } from "@playwright/test";
import { type LeagueEntry, type Match, RiotApiError } from "@tftvn/riot";
import { type CacheStore, createCache } from "./cache";
import { type PlayerRiotApi, createPlayerService, summarizeMatch } from "./player-service";

function memoryStore() {
  const values = new Map<string, { value: unknown; expiresAt: Date }>();
  const store: CacheStore = {
    async read(key, now) {
      const entry = values.get(key);
      return entry && entry.expiresAt > now ? entry.value : undefined;
    },
    async write(key, value, expiresAt) {
      values.set(key, { value, expiresAt });
    },
  };
  return { store, values };
}

function makeMatch(id: string, puuids: string[]): Match {
  return {
    metadata: { match_id: id, participants: puuids },
    info: {
      game_datetime: 1_763_500_000_000,
      game_length: 1834.6,
      game_version: "TFT Unreal Version ?.?.?.?",
      queue_id: 1100,
      tft_game_type: "standard",
      tft_set_number: 18,
      participants: puuids.map((puuid, index) => ({
        puuid,
        placement: index + 1,
        level: 9 - (index % 3),
        last_round: 30,
        gold_left: 0,
        total_damage_to_players: 100,
        riotIdGameName: `Player${index + 1}`,
        riotIdTagline: "VN2",
        traits: [
          { name: "DA_18_Coven", num_units: 1, style: 0, tier_current: 0, tier_total: 4 },
          { name: "DA_18_Slayer", num_units: 4, style: 3, tier_current: 2, tier_total: 3 },
          { name: "DA_18_Solar", num_units: 2, style: 1, tier_current: 1, tier_total: 3 },
        ],
        units: [{ character_id: "DA_18_Leona", itemNames: ["DA_DragonsClaw"], rarity: 0, tier: 2 }],
      })),
    },
  };
}

const PUUIDS = ["me", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];

function fakeRiot(overrides: Partial<PlayerRiotApi> = {}) {
  const calls: string[] = [];
  const track =
    <A extends unknown[], R>(name: string, implementation: (...args: A) => Promise<R>) =>
    (...args: A) => {
      calls.push(name);
      return implementation(...args);
    };
  const entries: LeagueEntry[] = Array.from({ length: 45 }, (_, index) => ({
    puuid: `c${index}`,
    leaguePoints: 1000 + index,
    rank: "I",
    wins: 10,
    losses: 5,
    veteran: false,
    inactive: false,
    freshBlood: false,
    hotStreak: index % 2 === 0,
  }));
  const riot: PlayerRiotApi = {
    accountByRiotId: track("accountByRiotId", async (gameName, tagLine) => ({
      puuid: "me",
      gameName,
      tagLine,
    })),
    accountByPuuid: track("accountByPuuid", async (puuid) => ({
      puuid,
      gameName: `Name ${puuid}`,
      tagLine: "VN2",
    })),
    summonerByPuuid: track("summonerByPuuid", async (puuid) => ({
      puuid,
      profileIconId: 29,
      summonerLevel: 321,
      revisionDate: 0,
    })),
    rankedByPuuid: track("rankedByPuuid", async () => [
      {
        queueType: "RANKED_TFT",
        tier: "CHALLENGER",
        rank: "I",
        leaguePoints: 1916,
        wins: 90,
        losses: 60,
      },
    ]),
    matchIdsByPuuid: track("matchIdsByPuuid", async (_puuid, count) =>
      ["VN2_1", "VN2_2"].slice(0, count),
    ),
    match: track("match", async (id) => makeMatch(id, PUUIDS)),
    apexLeague: track("apexLeague", async () => ({
      tier: "CHALLENGER",
      queue: "RANKED_TFT",
      entries,
    })),
    ...overrides,
  };
  return { riot, calls };
}

test.describe("summarizeMatch", () => {
  test("keeps only active traits, strongest first, and the whole lobby", () => {
    const summary = summarizeMatch(makeMatch("VN2_1", PUUIDS), "p3")!;
    expect(summary.placement).toBe(3);
    expect(summary.traits.map((trait) => trait.apiName)).toEqual(["DA_18_Slayer", "DA_18_Solar"]);
    expect(summary.lobby.map((player) => player.placement)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(summary.units[0]).toEqual({
      apiName: "DA_18_Leona",
      star: 2,
      items: ["DA_DragonsClaw"],
    });
    expect(summary.durationSeconds).toBe(1835);
  });

  test("returns null when the player is not in the match", () => {
    expect(summarizeMatch(makeMatch("VN2_1", PUUIDS), "ghost")).toBeNull();
  });
});

test.describe("player service", () => {
  test("builds a profile and serves repeat lookups from the cache", async () => {
    const { riot, calls } = fakeRiot();
    const service = createPlayerService({ riot, cached: createCache(memoryStore().store) });

    const profile = await service.profile(" Quý Đức ", "VN2");
    expect(profile).toMatchObject({
      puuid: "me",
      gameName: "Quý Đức",
      profileIconId: 29,
      summonerLevel: 321,
    });
    expect(profile.ranks[0]?.tier).toBe("CHALLENGER");
    expect(profile.matches.map((match) => match.id)).toEqual(["VN2_1", "VN2_2"]);

    const callsAfterFirst = calls.length;
    await service.profile("quý đức", "vn2");
    expect(calls.length).toBe(callsAfterFirst);
  });

  test("still shows the profile when the summoner call fails", async () => {
    const { riot } = fakeRiot({
      summonerByPuuid: async () => {
        throw new RiotApiError("unavailable", 503);
      },
    });
    const profile = await createPlayerService({
      riot,
      cached: createCache(memoryStore().store),
    }).profile("A", "VN2");
    expect(profile.profileIconId).toBeNull();
  });

  test("passes a missing Riot ID through as notFound and does not cache it", async () => {
    let attempts = 0;
    const { riot } = fakeRiot({
      accountByRiotId: async () => {
        attempts += 1;
        throw new RiotApiError("notFound", 404);
      },
    });
    const service = createPlayerService({ riot, cached: createCache(memoryStore().store) });
    for (let index = 0; index < 2; index += 1) {
      const error = await service.profile("ghost", "VN2").catch((caught: unknown) => caught);
      expect((error as RiotApiError).kind).toBe("notFound");
    }
    expect(attempts).toBe(2);
  });
});

test.describe("leaderboard", () => {
  test("sorts by LP, pages by 20 and resolves names", async () => {
    const { riot } = fakeRiot();
    const service = createPlayerService({ riot, cached: createCache(memoryStore().store) });
    const first = await service.leaderboard(1);
    expect(first).toMatchObject({ page: 1, pages: 3, total: 45 });
    expect(first.rows).toHaveLength(20);
    expect(first.rows[0]).toMatchObject({
      rank: 1,
      puuid: "c44",
      leaguePoints: 1044,
      gameName: "Name c44",
    });
    const last = await service.leaderboard(3);
    expect(last.rows.map((row) => row.rank)).toEqual([41, 42, 43, 44, 45]);
  });

  test("clamps out of range pages", async () => {
    const { riot } = fakeRiot();
    const service = createPlayerService({ riot, cached: createCache(memoryStore().store) });
    expect((await service.leaderboard(99)).page).toBe(3);
    expect((await service.leaderboard(-4)).page).toBe(1);
    expect((await service.leaderboard(Number.NaN)).page).toBe(1);
  });

  test("keeps a row when its name cannot be resolved", async () => {
    const { riot } = fakeRiot({
      accountByPuuid: async () => {
        throw new RiotApiError("unavailable", 500);
      },
    });
    const page = await createPlayerService({
      riot,
      cached: createCache(memoryStore().store),
    }).leaderboard(1);
    expect(page.rows[0]).toMatchObject({ gameName: null, leaguePoints: 1044 });
  });
});
