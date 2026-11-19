import { parseArgs } from "node:util";
import { patchForMatch } from "@tftvn/core";
import { createNodeDb } from "@tftvn/db/node";
import { type ApexTier, RANKED_TFT_QUEUE_ID, createRiotClient } from "@tftvn/riot";
import { requireEnv } from "./env";
import { trackEtlRun } from "./etl-run";
import { currentSetWithPatches, knownMatchIds, storeMatch } from "./match-store";
import { revalidate } from "./revalidate";

const TIERS: ApexTier[] = ["challenger", "grandmaster", "master"];

const { values: args } = parseArgs({
  options: {
    players: { type: "string", default: "10" },
    matches: { type: "string", default: "10" },
  },
});

const playersPerTier = Math.max(1, Number(args.players));
const matchesPerPlayer = Math.min(100, Math.max(1, Number(args.matches)));

async function main() {
  const riot = createRiotClient({ apiKey: requireEnv("RIOT_API_KEY") });
  const { db, close } = createNodeDb(requireEnv("DATABASE_URL_DIRECT"));

  try {
    const summary = await trackEtlRun(db, "sync-matches", async () => {
      const { setId, patches } = await currentSetWithPatches(db);
      const tierByMatch = new Map<string, ApexTier>();
      let players = 0;

      for (const tier of TIERS) {
        const league = await riot.apexLeague(tier);
        const top = [...league.entries]
          .sort((left, right) => right.leaguePoints - left.leaguePoints)
          .slice(0, playersPerTier);
        for (const entry of top) {
          players += 1;
          for (const id of await riot.matchIdsByPuuid(entry.puuid, matchesPerPlayer)) {
            if (!tierByMatch.has(id)) {
              tierByMatch.set(id, tier);
            }
          }
        }
        console.log(`${tier}: ${top.length} players, ${tierByMatch.size} match ids so far`);
      }

      const known = await knownMatchIds(db, [...tierByMatch.keys()]);
      const pending = [...tierByMatch].filter(([id]) => !known.has(id));
      let stored = 0;
      let skippedQueue = 0;
      let skippedSet = 0;

      for (const [index, [id, tier]] of pending.entries()) {
        const match = await riot.match(id);
        if (match.info.queue_id !== RANKED_TFT_QUEUE_ID) {
          skippedQueue += 1;
        } else if (match.info.tft_set_number !== setId) {
          skippedSet += 1;
        } else {
          const patchId = patchForMatch(patches, new Date(match.info.game_datetime));
          if (patchId && (await storeMatch(db, { match, setId, patchId, rankTier: tier }))) {
            stored += 1;
          }
        }
        if ((index + 1) % 25 === 0) {
          console.log(`${index + 1}/${pending.length} matches checked, ${stored} stored`);
        }
      }

      return {
        setId,
        players,
        matchIds: tierByMatch.size,
        alreadyKnown: known.size,
        fetched: pending.length,
        stored,
        skippedQueue,
        skippedSet,
        revalidated: stored > 0 ? await revalidate("stats") : false,
      };
    });
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await close();
  }
}

await main();
