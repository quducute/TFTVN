import { matchStats } from "@tftvn/core";
import { entityStats, gameSets, matchParticipants, matches, patches, statTotals } from "@tftvn/db";
import type { NodeDb } from "@tftvn/db/node";
import type { ApexTier, Match } from "@tftvn/riot";
import { eq, inArray, sql } from "drizzle-orm";

export async function currentSetWithPatches(db: NodeDb) {
  const [current] = await db
    .select({ id: gameSets.id })
    .from(gameSets)
    .where(eq(gameSets.isCurrent, true))
    .limit(1);
  if (!current) {
    throw new Error("No current set. Run sync-gamedata first.");
  }
  const setPatches = await db
    .select({ id: patches.id, releasedAt: patches.releasedAt })
    .from(patches)
    .where(eq(patches.setId, current.id));
  return { setId: current.id, patches: setPatches };
}

export async function knownMatchIds(db: NodeDb, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) {
    return new Set();
  }
  const rows = await db.select({ id: matches.id }).from(matches).where(inArray(matches.id, ids));
  return new Set(rows.map((row) => row.id));
}

export interface StoreMatchInput {
  match: Match;
  setId: number;
  patchId: string;
  rankTier: ApexTier;
}

export async function storeMatch(db: NodeDb, input: StoreMatchInput): Promise<boolean> {
  const { match, setId, patchId, rankTier } = input;
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(matches)
      .values({
        id: match.metadata.match_id,
        setId,
        patchId,
        queueId: match.info.queue_id,
        sourceRankTier: rankTier,
        playedAt: new Date(match.info.game_datetime).toISOString(),
      })
      .onConflictDoNothing()
      .returning({ id: matches.id });
    if (inserted.length === 0) {
      return false;
    }

    await tx.insert(matchParticipants).values(
      match.info.participants.map((participant) => ({
        matchId: match.metadata.match_id,
        puuid: participant.puuid,
        placement: participant.placement,
        playerLevel: participant.level,
        units: participant.units.map((unit) => ({
          champion_api_name: unit.character_id,
          star_level: unit.tier,
          items: unit.itemNames,
        })),
        traits: participant.traits.map((trait) => ({
          trait_api_name: trait.name,
          level: trait.tier_current,
          unit_count: trait.num_units,
        })),
      })),
    );

    const rows = matchStats(match.info.participants).map((row) => ({
      setId,
      patchId,
      rankTier,
      kind: row.kind,
      apiName: row.apiName,
      variant: row.variant,
      games: row.games,
      placementSum: row.placementSum,
      top1Count: row.top1Count,
      top4Count: row.top4Count,
    }));
    if (rows.length > 0) {
      await tx
        .insert(entityStats)
        .values(rows)
        .onConflictDoUpdate({
          target: [
            entityStats.setId,
            entityStats.patchId,
            entityStats.rankTier,
            entityStats.kind,
            entityStats.apiName,
            entityStats.variant,
          ],
          set: {
            games: sql`${entityStats.games} + excluded.games`,
            placementSum: sql`${entityStats.placementSum} + excluded.placement_sum`,
            top1Count: sql`${entityStats.top1Count} + excluded.top1_count`,
            top4Count: sql`${entityStats.top4Count} + excluded.top4_count`,
          },
        });
    }

    await tx
      .insert(statTotals)
      .values({
        setId,
        patchId,
        rankTier,
        matchCount: 1,
        participantCount: match.info.participants.length,
      })
      .onConflictDoUpdate({
        target: [statTotals.setId, statTotals.patchId, statTotals.rankTier],
        set: {
          matchCount: sql`${statTotals.matchCount} + 1`,
          participantCount: sql`${statTotals.participantCount} + excluded.participant_count`,
        },
      });
    return true;
  });
}
