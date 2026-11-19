import { type StatKind, toStatView } from "@tftvn/core";
import { entityStats, etlRuns, getDb, statTotals } from "@tftvn/db";
import { and, desc, eq, ne } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

export const STATS_TAG = "stats";
export const RANK_TIERS = ["challenger", "grandmaster", "master"] as const;
export const STAT_SECTIONS = ["champions", "traits", "items"] as const;

export type RankTier = (typeof RANK_TIERS)[number];
export type StatSection = (typeof STAT_SECTIONS)[number];

export const SECTION_KIND: Record<StatSection, StatKind> = {
  champions: "champion",
  traits: "trait",
  items: "item",
};

export interface StatVariant {
  key: string;
  games: number;
  averagePlacement: number;
}

export interface StatRow {
  apiName: string;
  games: number;
  pickRate: number;
  averagePlacement: number;
  top4Rate: number;
  top1Rate: number;
  variants: StatVariant[];
}

export interface StatsTable {
  matchCount: number;
  participantCount: number;
  rows: StatRow[];
}

type Sums = { games: number; placementSum: number; top1Count: number; top4Count: number };

const add = (target: Sums, source: Sums) => {
  target.games += source.games;
  target.placementSum += source.placementSum;
  target.top1Count += source.top1Count;
  target.top4Count += source.top4Count;
};

export async function getStatsTable(
  setId: number,
  rankTier: RankTier,
  section: StatSection,
): Promise<StatsTable> {
  "use cache";
  cacheLife("max");
  cacheTag(STATS_TAG);

  const db = getDb();
  const columns = {
    apiName: entityStats.apiName,
    variant: entityStats.variant,
    games: entityStats.games,
    placementSum: entityStats.placementSum,
    top1Count: entityStats.top1Count,
    top4Count: entityStats.top4Count,
  };
  const scope = and(eq(entityStats.setId, setId), eq(entityStats.rankTier, rankTier));
  const [totalRows, statRows, championItemRows] = await Promise.all([
    db
      .select({ matchCount: statTotals.matchCount, participantCount: statTotals.participantCount })
      .from(statTotals)
      .where(and(eq(statTotals.setId, setId), eq(statTotals.rankTier, rankTier))),
    db
      .select(columns)
      .from(entityStats)
      .where(and(scope, eq(entityStats.kind, SECTION_KIND[section]))),
    section === "champions"
      ? db
          .select(columns)
          .from(entityStats)
          .where(and(scope, eq(entityStats.kind, "item"), ne(entityStats.variant, "")))
      : Promise.resolve([]),
  ]);

  const matchCount = totalRows.reduce((total, row) => total + row.matchCount, 0);
  const participantCount = totalRows.reduce((total, row) => total + row.participantCount, 0);

  const totals = new Map<string, Sums>();
  const variants = new Map<string, Map<string, Sums>>();
  const addVariant = (owner: string, key: string, row: Sums) => {
    const byVariant = variants.get(owner) ?? new Map<string, Sums>();
    const sums = byVariant.get(key) ?? { games: 0, placementSum: 0, top1Count: 0, top4Count: 0 };
    add(sums, row);
    byVariant.set(key, sums);
    variants.set(owner, byVariant);
  };
  for (const row of statRows) {
    if (row.variant === "") {
      const sums = totals.get(row.apiName) ?? {
        games: 0,
        placementSum: 0,
        top1Count: 0,
        top4Count: 0,
      };
      add(sums, row);
      totals.set(row.apiName, sums);
    } else {
      addVariant(row.apiName, row.variant, row);
    }
  }
  for (const row of championItemRows) {
    addVariant(row.variant, row.apiName, row);
  }

  const rows = [...totals].map(([apiName, sums]): StatRow => {
    const view = toStatView(sums, participantCount);
    return {
      apiName,
      ...view,
      variants: [...(variants.get(apiName) ?? new Map<string, Sums>())]
        .map(([key, variantSums]) => ({
          key,
          games: variantSums.games,
          averagePlacement: toStatView(variantSums, participantCount).averagePlacement,
        }))
        .sort((left, right) => right.games - left.games)
        .slice(0, 3),
    };
  });
  rows.sort((left, right) => right.games - left.games);
  return { matchCount, participantCount, rows };
}

export async function getLastStatsSync(): Promise<string | null> {
  "use cache";
  cacheLife("max");
  cacheTag(STATS_TAG);

  const [row] = await getDb()
    .select({ finishedAt: etlRuns.finishedAt })
    .from(etlRuns)
    .where(and(eq(etlRuns.job, "sync-matches"), eq(etlRuns.status, "succeeded")))
    .orderBy(desc(etlRuns.finishedAt))
    .limit(1);
  return row?.finishedAt ?? null;
}
