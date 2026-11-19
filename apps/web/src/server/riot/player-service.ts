import type { Match, RankedEntry, RiotClient } from "@tftvn/riot";
import type { Cached } from "./cache";

export type PlayerRiotApi = Pick<
  RiotClient,
  | "accountByRiotId"
  | "accountByPuuid"
  | "summonerByPuuid"
  | "rankedByPuuid"
  | "matchIdsByPuuid"
  | "match"
  | "apexLeague"
>;

export interface PlayerUnit {
  apiName: string;
  star: number;
  items: string[];
}

export interface PlayerTrait {
  apiName: string;
  style: number;
  level: number;
  units: number;
}

export interface LobbyPlayer {
  puuid: string;
  name: string | null;
  tag: string | null;
  placement: number;
  level: number;
  units: PlayerUnit[];
}

export interface PlayerMatch {
  id: string;
  setNumber: number;
  queueId: number;
  playedAt: number;
  durationSeconds: number;
  placement: number;
  level: number;
  traits: PlayerTrait[];
  units: PlayerUnit[];
  lobby: LobbyPlayer[];
}

export interface PlayerProfile {
  puuid: string;
  gameName: string;
  tagLine: string;
  profileIconId: number | null;
  summonerLevel: number | null;
  ranks: RankedEntry[];
  matches: PlayerMatch[];
}

export interface LeaderboardRow {
  rank: number;
  puuid: string;
  gameName: string | null;
  tagLine: string | null;
  leaguePoints: number;
  wins: number;
  losses: number;
  hotStreak: boolean;
}

export interface LeaderboardPage {
  page: number;
  pages: number;
  total: number;
  rows: LeaderboardRow[];
}

export const CACHE_SECONDS = {
  account: 60 * 60,
  accountByPuuid: 24 * 60 * 60,
  summoner: 10 * 60,
  ranked: 5 * 60,
  matchIds: 5 * 60,
  match: 7 * 24 * 60 * 60,
  league: 5 * 60,
} as const;

const units = (list: Match["info"]["participants"][number]["units"]): PlayerUnit[] =>
  list.map((unit) => ({ apiName: unit.character_id, star: unit.tier, items: unit.itemNames }));

export function summarizeMatch(match: Match, puuid: string): PlayerMatch | null {
  const me = match.info.participants.find((participant) => participant.puuid === puuid);
  if (!me) {
    return null;
  }
  return {
    id: match.metadata.match_id,
    setNumber: match.info.tft_set_number,
    queueId: match.info.queue_id,
    playedAt: match.info.game_datetime,
    durationSeconds: Math.round(match.info.game_length),
    placement: me.placement,
    level: me.level,
    traits: me.traits
      .filter((trait) => trait.tier_current > 0)
      .map((trait) => ({
        apiName: trait.name,
        style: trait.style,
        level: trait.tier_current,
        units: trait.num_units,
      }))
      .sort((left, right) => right.style - left.style || right.units - left.units),
    units: units(me.units),
    lobby: [...match.info.participants]
      .sort((left, right) => left.placement - right.placement)
      .map((participant) => ({
        puuid: participant.puuid,
        name: participant.riotIdGameName ?? null,
        tag: participant.riotIdTagline ?? null,
        placement: participant.placement,
        level: participant.level,
        units: units(participant.units),
      })),
  };
}

const normalize = (value: string) => value.trim().toLowerCase();

export function createPlayerService({ riot, cached }: { riot: PlayerRiotApi; cached: Cached }) {
  return {
    async profile(gameName: string, tagLine: string, matchCount = 5): Promise<PlayerProfile> {
      const account = await cached(
        `account:riot-id:${normalize(gameName)}#${normalize(tagLine)}`,
        CACHE_SECONDS.account,
        () => riot.accountByRiotId(gameName.trim(), tagLine.trim()),
      );
      const [summoner, ranks, matchIds] = await Promise.all([
        cached(`summoner:${account.puuid}`, CACHE_SECONDS.summoner, () =>
          riot.summonerByPuuid(account.puuid),
        ).catch(() => null),
        cached(`ranked:${account.puuid}`, CACHE_SECONDS.ranked, () =>
          riot.rankedByPuuid(account.puuid),
        ),
        cached(`match-ids:${account.puuid}:${matchCount}`, CACHE_SECONDS.matchIds, () =>
          riot.matchIdsByPuuid(account.puuid, matchCount),
        ),
      ]);
      const matches = await Promise.all(
        matchIds.map((id) => cached(`match:${id}`, CACHE_SECONDS.match, () => riot.match(id))),
      );
      return {
        puuid: account.puuid,
        gameName: account.gameName,
        tagLine: account.tagLine,
        profileIconId: summoner?.profileIconId ?? null,
        summonerLevel: summoner?.summonerLevel ?? null,
        ranks,
        matches: matches
          .map((match) => summarizeMatch(match, account.puuid))
          .filter((match): match is PlayerMatch => match != null),
      };
    },

    async leaderboard(page: number, pageSize = 20): Promise<LeaderboardPage> {
      const league = await cached("league:challenger", CACHE_SECONDS.league, () =>
        riot.apexLeague("challenger"),
      );
      const sorted = [...league.entries].sort(
        (left, right) => right.leaguePoints - left.leaguePoints,
      );
      const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
      const current = Math.min(Math.max(1, Math.trunc(page) || 1), pages);
      const start = (current - 1) * pageSize;

      const rows = await Promise.all(
        sorted.slice(start, start + pageSize).map(async (entry, index): Promise<LeaderboardRow> => {
          const account = await cached(
            `account:puuid:${entry.puuid}`,
            CACHE_SECONDS.accountByPuuid,
            () => riot.accountByPuuid(entry.puuid),
          ).catch(() => null);
          return {
            rank: start + index + 1,
            puuid: entry.puuid,
            gameName: account?.gameName ?? null,
            tagLine: account?.tagLine ?? null,
            leaguePoints: entry.leaguePoints,
            wins: entry.wins,
            losses: entry.losses,
            hotStreak: entry.hotStreak,
          };
        }),
      );
      return { page: current, pages, total: sorted.length, rows };
    },
  };
}

export type PlayerService = ReturnType<typeof createPlayerService>;
