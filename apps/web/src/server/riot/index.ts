import { RiotApiError, createRiotClient } from "@tftvn/riot";
import { createCache, dbCacheStore } from "./cache";
import { type PlayerService, createPlayerService } from "./player-service";

let service: PlayerService | undefined;

export function getPlayerService(): PlayerService {
  if (!service) {
    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) {
      throw new RiotApiError("unauthorized", null);
    }
    service = createPlayerService({
      riot: createRiotClient({ apiKey }),
      cached: createCache(dbCacheStore),
    });
  }
  return service;
}
