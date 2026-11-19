import { type ArticleCategory, REACTION_KINDS } from "@tftvn/core";
import { articleComps, articleReactions, articles, comps, getDb, users } from "@tftvn/db";
import { type SQL, and, arrayContains, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { ArticleRecord, ArticleRepository, ArticleReview, ReactionCounts } from "./types";

const reviewers = alias(users, "reviewers");

const columns = {
  id: articles.id,
  publicId: articles.publicId,
  authorId: articles.authorId,
  authorUsername: users.username,
  title: articles.title,
  category: articles.category,
  setId: articles.setId,
  tags: articles.tags,
  body: articles.body,
  status: articles.status,
  reviewerUsername: reviewers.username,
  reviewedAt: articles.reviewedAt,
  reviewNote: articles.reviewNote,
  compIds: sql<string[]>`coalesce((
    select array_agg(${comps.publicId}::text order by ${comps.id})
    from ${articleComps}
    join ${comps} on ${comps.id} = ${articleComps.compId} and ${comps.deletedAt} is null
    where ${articleComps.articleId} = ${articles.id}
  ), '{}')`,
  createdAt: articles.createdAt,
  updatedAt: articles.updatedAt,
};

const select = () =>
  getDb()
    .select(columns)
    .from(articles)
    .innerJoin(users, eq(users.id, articles.authorId))
    .leftJoin(reviewers, eq(reviewers.id, articles.reviewedBy));

type Row = Awaited<ReturnType<typeof select>>[number];

const toRecord = (row: Row): ArticleRecord => ({
  ...row,
  category: row.category as ArticleCategory,
  compIds: row.compIds ?? [],
});

const reviewValues = (review: ArticleReview | null) => ({
  status: review?.status ?? ("queued" as const),
  reviewedBy: review?.reviewerId ?? null,
  reviewNote: review?.note ?? null,
  reviewedAt: review ? review.now.toISOString() : null,
});

export function createDbArticleRepository(): ArticleRepository {
  const byId = async (id: number) => {
    const [row] = await select().where(eq(articles.id, id)).limit(1);
    if (!row) {
      throw new Error(`article ${id} not found`);
    }
    return toRecord(row);
  };

  const replaceComps = async (articleId: number, compIds: number[]) => {
    await getDb().delete(articleComps).where(eq(articleComps.articleId, articleId));
    if (compIds.length > 0) {
      await getDb()
        .insert(articleComps)
        .values(compIds.map((compId) => ({ articleId, compId })))
        .onConflictDoNothing();
    }
  };

  return {
    async insert({ review, ...input }, compIds) {
      const [row] = await getDb()
        .insert(articles)
        .values({ ...input, ...reviewValues(review) })
        .returning({ id: articles.id });
      await replaceComps(row!.id, compIds);
      return byId(row!.id);
    },

    async update(id, input, { resetReview }, compIds) {
      await getDb()
        .update(articles)
        .set({ ...input, ...(resetReview ? reviewValues(null) : {}) })
        .where(eq(articles.id, id));
      await replaceComps(id, compIds);
      return byId(id);
    },

    async findByPublicId(publicId) {
      const [row] = await select()
        .where(and(eq(articles.publicId, publicId), isNull(articles.deletedAt)))
        .limit(1);
      return row ? toRecord(row) : null;
    },

    async softDelete(id, now) {
      await getDb()
        .update(articles)
        .set({ deletedAt: now.toISOString() })
        .where(eq(articles.id, id));
    },

    async review(id, review) {
      await getDb().update(articles).set(reviewValues(review)).where(eq(articles.id, id));
      return byId(id);
    },

    async list(filter) {
      const conditions: SQL[] = [isNull(articles.deletedAt)];
      if (filter.status) {
        conditions.push(eq(articles.status, filter.status));
      }
      if (filter.authorId != null) {
        conditions.push(eq(articles.authorId, filter.authorId));
      }
      if (filter.setId != null) {
        conditions.push(eq(articles.setId, filter.setId));
      }
      if (filter.category) {
        conditions.push(eq(articles.category, filter.category));
      }
      if (filter.tag) {
        conditions.push(arrayContains(articles.tags, [filter.tag]));
      }
      const where = and(...conditions);
      const [rows, [total]] = await Promise.all([
        select()
          .where(where)
          .orderBy(desc(articles.createdAt), desc(articles.id))
          .limit(filter.limit)
          .offset(filter.offset),
        getDb().select({ value: count() }).from(articles).where(where),
      ]);
      return { rows: rows.map(toRecord), total: total?.value ?? 0 };
    },

    async setReaction(articleId, userId, kind) {
      if (kind) {
        await getDb()
          .insert(articleReactions)
          .values({ articleId, userId, kind })
          .onConflictDoUpdate({
            target: [articleReactions.articleId, articleReactions.userId],
            set: { kind, createdAt: sql`now()` },
          });
      } else {
        await getDb()
          .delete(articleReactions)
          .where(
            and(eq(articleReactions.articleId, articleId), eq(articleReactions.userId, userId)),
          );
      }
    },

    async reactions(articleId, userId) {
      const [grouped, mine] = await Promise.all([
        getDb()
          .select({ kind: articleReactions.kind, value: count() })
          .from(articleReactions)
          .where(eq(articleReactions.articleId, articleId))
          .groupBy(articleReactions.kind),
        userId == null
          ? Promise.resolve([])
          : getDb()
              .select({ kind: articleReactions.kind })
              .from(articleReactions)
              .where(
                and(eq(articleReactions.articleId, articleId), eq(articleReactions.userId, userId)),
              )
              .limit(1),
      ]);
      const counts = Object.fromEntries(REACTION_KINDS.map((kind) => [kind, 0])) as ReactionCounts;
      for (const row of grouped) {
        counts[row.kind] = row.value;
      }
      return { counts, mine: mine[0]?.kind ?? null };
    },
  };
}

export async function resolveCompIds(publicIds: string[]): Promise<Map<string, number>> {
  const rows = await getDb()
    .select({ id: comps.id, publicId: comps.publicId })
    .from(comps)
    .where(and(inArray(comps.publicId, publicIds), isNull(comps.deletedAt)));
  return new Map(rows.map((row) => [row.publicId, row.id]));
}
