import { etlRuns, gameSets, matches, rateLimits, riotCache, userTokens } from "@tftvn/db";
import { createNodeDb } from "@tftvn/db/node";
import { and, isNotNull, lt, ne, or, sql } from "drizzle-orm";
import { requireEnv } from "./env";
import { trackEtlRun } from "./etl-run";

const DAY = 24 * 60 * 60 * 1000;

export const RETENTION = {
  rateLimitDays: 1,
  expiredTokenDays: 1,
  usedTokenDays: 7,
  etlRunDays: 90,
} as const;

const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * DAY).toISOString();

async function main() {
  const { db, close } = createNodeDb(requireEnv("DATABASE_URL_DIRECT"));
  try {
    const summary = await trackEtlRun(db, "cleanup", async () => {
      const now = new Date();
      const [current] = await db
        .select({ id: gameSets.id })
        .from(gameSets)
        .where(sql`${gameSets.isCurrent}`)
        .limit(1);

      const removedCache = await db
        .delete(riotCache)
        .where(lt(riotCache.expiresAt, now.toISOString()))
        .returning({ key: riotCache.key });
      const removedLimits = await db
        .delete(rateLimits)
        .where(lt(rateLimits.windowStart, daysAgo(now, RETENTION.rateLimitDays)))
        .returning({ bucket: rateLimits.bucket });
      const removedTokens = await db
        .delete(userTokens)
        .where(
          or(
            lt(userTokens.expiresAt, daysAgo(now, RETENTION.expiredTokenDays)),
            and(
              isNotNull(userTokens.usedAt),
              lt(userTokens.usedAt, daysAgo(now, RETENTION.usedTokenDays)),
            ),
          ),
        )
        .returning({ id: userTokens.id });
      const removedMatches = current
        ? await db
            .delete(matches)
            .where(ne(matches.setId, current.id))
            .returning({ id: matches.id })
        : [];
      const removedRuns = await db
        .delete(etlRuns)
        .where(lt(etlRuns.startedAt, daysAgo(now, RETENTION.etlRunDays)))
        .returning({ id: etlRuns.id });

      return {
        riotCache: removedCache.length,
        rateLimits: removedLimits.length,
        userTokens: removedTokens.length,
        oldSetMatches: removedMatches.length,
        etlRuns: removedRuns.length,
      };
    });
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await close();
  }
}

await main();
