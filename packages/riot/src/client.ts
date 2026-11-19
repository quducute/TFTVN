import axios, { type AxiosInstance, isAxiosError } from "axios";
import { type RateLimiter, createRateLimiter, DEVELOPMENT_KEY_WINDOWS } from "./rate-limiter";
import type { ApexTier, LeagueList, Match, RankedEntry, RiotAccount, Summoner } from "./types";

export const RIOT_HOSTS = {
  platform: "https://vn2.api.riotgames.com",
  match: "https://sea.api.riotgames.com",
  account: "https://asia.api.riotgames.com",
} as const;

export type RiotErrorKind = "notFound" | "rateLimited" | "unauthorized" | "unavailable";

export class RiotApiError extends Error {
  constructor(
    readonly kind: RiotErrorKind,
    readonly status: number | null,
  ) {
    super(`Riot API ${kind}${status ? ` (${status})` : ""}`);
  }
}

export interface RiotClientOptions {
  apiKey: string;
  http?: AxiosInstance;
  limiter?: RateLimiter;
  maxRetries?: number;
}

function classify(status: number | undefined): RiotErrorKind {
  if (status === 404) {
    return "notFound";
  }
  if (status === 429) {
    return "rateLimited";
  }
  if (status === 401 || status === 403) {
    return "unauthorized";
  }
  return "unavailable";
}

export function createRiotClient({
  apiKey,
  http = axios.create({ timeout: 15_000 }),
  limiter = createRateLimiter(DEVELOPMENT_KEY_WINDOWS),
  maxRetries = 3,
}: RiotClientOptions) {
  async function get<T>(url: string, params?: Record<string, string | number>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      await limiter.schedule();
      try {
        const response = await http.get<T>(url, { params, headers: { "X-Riot-Token": apiKey } });
        return response.data;
      } catch (error) {
        const status = isAxiosError(error) ? error.response?.status : undefined;
        const kind = classify(status);
        const retryable = kind === "rateLimited" || (kind === "unavailable" && status != null);
        if (!retryable || attempt >= maxRetries) {
          throw new RiotApiError(kind, status ?? null);
        }
        const retryAfter = Number(
          isAxiosError(error) ? error.response?.headers?.["retry-after"] : undefined,
        );
        limiter.pause(
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000,
        );
      }
    }
  }

  const path = (value: string) => encodeURIComponent(value);

  return {
    accountByRiotId: (gameName: string, tagLine: string) =>
      get<RiotAccount>(
        `${RIOT_HOSTS.account}/riot/account/v1/accounts/by-riot-id/${path(gameName)}/${path(tagLine)}`,
      ),
    accountByPuuid: (puuid: string) =>
      get<RiotAccount>(`${RIOT_HOSTS.account}/riot/account/v1/accounts/by-puuid/${path(puuid)}`),
    summonerByPuuid: (puuid: string) =>
      get<Summoner>(`${RIOT_HOSTS.platform}/tft/summoner/v1/summoners/by-puuid/${path(puuid)}`),
    rankedByPuuid: (puuid: string) =>
      get<RankedEntry[]>(`${RIOT_HOSTS.platform}/tft/league/v1/by-puuid/${path(puuid)}`),
    apexLeague: (tier: ApexTier) => get<LeagueList>(`${RIOT_HOSTS.platform}/tft/league/v1/${tier}`),
    matchIdsByPuuid: (puuid: string, count: number) =>
      get<string[]>(`${RIOT_HOSTS.match}/tft/match/v1/matches/by-puuid/${path(puuid)}/ids`, {
        count,
      }),
    match: (matchId: string) =>
      get<Match>(`${RIOT_HOSTS.match}/tft/match/v1/matches/${path(matchId)}`),
  };
}

export type RiotClient = ReturnType<typeof createRiotClient>;
