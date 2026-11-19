import type { CompDifficulty, CompPlaystyle, CompUnit } from "@tftvn/core";
import { bookmarks, comps, getDb, users } from "@tftvn/db";
import { and, arrayContains, count, desc, eq, isNotNull, isNull, type SQL, sql } from "drizzle-orm";
import type { CompContent, CompRecord, CompRepository } from "./types";

interface StoredUnit {
  slot: number;
  champion_api_name: string;
  star_level: number;
  hex: number;
  items: string[];
}

const toStoredBoard = (board: CompUnit[]): StoredUnit[] =>
  board.map((unit, slot) => ({
    slot,
    champion_api_name: unit.championApiName,
    star_level: unit.starLevel,
    hex: unit.hex,
    items: unit.items,
  }));

const fromStoredBoard = (board: unknown): CompUnit[] =>
  (Array.isArray(board) ? (board as StoredUnit[]) : [])
    .toSorted((left, right) => left.slot - right.slot)
    .map((unit) => ({
      championApiName: unit.champion_api_name,
      starLevel: unit.star_level,
      hex: unit.hex,
      items: unit.items ?? [],
    }));

const columns = {
  id: comps.id,
  publicId: comps.publicId,
  ownerId: comps.ownerId,
  ownerUsername: users.username,
  setId: comps.setId,
  name: comps.name,
  description: comps.description,
  difficulty: comps.difficulty,
  playstyle: comps.playstyle,
  avatarChampionApiName: comps.avatarChampionApiName,
  board: comps.board,
  champions: comps.champions,
  augments: comps.augments,
  metaTier: comps.metaTier,
  metaPatchId: comps.metaPatchId,
  metaUpdatedAt: comps.metaUpdatedAt,
  createdAt: comps.createdAt,
  updatedAt: comps.updatedAt,
};

const select = () =>
  getDb().select(columns).from(comps).innerJoin(users, eq(users.id, comps.ownerId));

type Row = Awaited<ReturnType<typeof select>>[number];

const toRecord = (row: Row): CompRecord => ({
  ...row,
  difficulty: row.difficulty as CompDifficulty | null,
  playstyle: row.playstyle as CompPlaystyle | null,
  board: fromStoredBoard(row.board),
});

const toValues = (input: CompContent) => ({
  setId: input.setId,
  name: input.name,
  description: input.description,
  difficulty: input.difficulty,
  playstyle: input.playstyle,
  avatarChampionApiName: input.avatarChampionApiName,
  board: toStoredBoard(input.board),
  champions: input.champions,
  augments: input.augments,
});

export function createDbCompRepository(): CompRepository {
  const byId = async (id: number) => {
    const [row] = await select().where(eq(comps.id, id)).limit(1);
    if (!row) {
      throw new Error(`comp ${id} not found`);
    }
    return toRecord(row);
  };

  return {
    async insert(input) {
      const [row] = await getDb()
        .insert(comps)
        .values({ ...toValues(input), publicId: input.publicId, ownerId: input.ownerId })
        .returning({ id: comps.id });
      return byId(row!.id);
    },

    async update(id, input) {
      await getDb().update(comps).set(toValues(input)).where(eq(comps.id, id));
      return byId(id);
    },

    async findByPublicId(publicId) {
      const [row] = await select()
        .where(and(eq(comps.publicId, publicId), isNull(comps.deletedAt)))
        .limit(1);
      return row ? toRecord(row) : null;
    },

    async softDelete(id, now) {
      await getDb().update(comps).set({ deletedAt: now.toISOString() }).where(eq(comps.id, id));
    },

    async setMeta(id, meta) {
      await getDb()
        .update(comps)
        .set({
          metaTier: meta?.tier ?? null,
          metaPatchId: meta?.patchId ?? null,
          metaUpdatedAt: meta ? meta.now.toISOString() : null,
        })
        .where(eq(comps.id, id));
      return byId(id);
    },

    async list(filter) {
      const conditions: SQL[] = [isNull(comps.deletedAt)];
      if (filter.setId != null) {
        conditions.push(eq(comps.setId, filter.setId));
      }
      if (filter.ownerId != null) {
        conditions.push(eq(comps.ownerId, filter.ownerId));
      }
      if (filter.metaOnly) {
        conditions.push(isNotNull(comps.metaTier));
      }
      if (filter.championApiName) {
        conditions.push(arrayContains(comps.champions, [filter.championApiName]));
      }
      if (filter.bookmarkedBy != null) {
        conditions.push(
          sql`exists (select 1 from ${bookmarks} where ${bookmarks.compId} = ${comps.id} and ${bookmarks.userId} = ${filter.bookmarkedBy})`,
        );
      }
      const where = and(...conditions);
      const [rows, [total]] = await Promise.all([
        select()
          .where(where)
          .orderBy(desc(comps.updatedAt), desc(comps.id))
          .limit(filter.limit)
          .offset(filter.offset),
        getDb().select({ value: count() }).from(comps).where(where),
      ]);
      return { rows: rows.map(toRecord), total: total?.value ?? 0 };
    },

    async setBookmark(userId, compId, bookmarked) {
      if (bookmarked) {
        await getDb().insert(bookmarks).values({ userId, compId }).onConflictDoNothing();
      } else {
        await getDb()
          .delete(bookmarks)
          .where(and(eq(bookmarks.userId, userId), eq(bookmarks.compId, compId)));
      }
    },

    async isBookmarked(userId, compId) {
      const [row] = await getDb()
        .select({ userId: bookmarks.userId })
        .from(bookmarks)
        .where(and(eq(bookmarks.userId, userId), eq(bookmarks.compId, compId)))
        .limit(1);
      return row != null;
    },

    async bookmarkCount(compId) {
      const [row] = await getDb()
        .select({ value: count() })
        .from(bookmarks)
        .where(eq(bookmarks.compId, compId));
      return row?.value ?? 0;
    },
  };
}
