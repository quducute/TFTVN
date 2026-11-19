import axios, { isAxiosError } from "axios";
import type { RiotAccountLookup } from "./types";

const ACCOUNT_URL = "https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id";

export function createRiotAccountLookup(apiKey: string | undefined): RiotAccountLookup {
  return {
    async findAccount(gameName, tagLine) {
      if (!apiKey) {
        return { status: "unconfigured" };
      }
      try {
        const response = await axios.get<{ puuid: string }>(
          `${ACCOUNT_URL}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
          { headers: { "X-Riot-Token": apiKey }, timeout: 10_000 },
        );
        return { status: "found", puuid: response.data.puuid };
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 404) {
          return { status: "notFound" };
        }
        return { status: "unavailable" };
      }
    },
  };
}
