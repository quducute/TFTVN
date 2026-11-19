import { REACTION_KINDS, type ReactionKind } from "@tftvn/core";
import type { ArticleRecord, ArticleRepository, ArticleReview, ReactionCounts } from "./types";

interface StoredArticle extends Omit<ArticleRecord, "compIds" | "reviewerUsername"> {
  reviewerId: number | null;
  compIds: number[];
  deletedAt: Date | null;
}

export function createMemoryArticleRepository(lookup: {
  username: (userId: number) => string;
  compPublicId: (compId: number) => string | null;
}) {
  const articles: StoredArticle[] = [];
  const reactions = new Map<string, ReactionKind>();
  let clock = 0;
  const stamp = () => new Date(Date.UTC(2026, 10, 19, 1, 0, clock++)).toISOString();

  const toRecord = (stored: StoredArticle): ArticleRecord => ({
    id: stored.id,
    publicId: stored.publicId,
    authorId: stored.authorId,
    authorUsername: lookup.username(stored.authorId),
    title: stored.title,
    category: stored.category,
    setId: stored.setId,
    tags: [...stored.tags],
    body: stored.body,
    status: stored.status,
    reviewerUsername: stored.reviewerId == null ? null : lookup.username(stored.reviewerId),
    reviewedAt: stored.reviewedAt,
    reviewNote: stored.reviewNote,
    compIds: stored.compIds
      .map(lookup.compPublicId)
      .filter((publicId): publicId is string => publicId != null),
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  });

  const byId = (id: number) => {
    const article = articles.find((candidate) => candidate.id === id);
    if (!article) {
      throw new Error(`article ${id} not found`);
    }
    return article;
  };

  const applyReview = (article: StoredArticle, review: ArticleReview | null) => {
    article.status = review?.status ?? "queued";
    article.reviewerId = review?.reviewerId ?? null;
    article.reviewNote = review?.note ?? null;
    article.reviewedAt = review ? review.now.toISOString() : null;
  };

  const repository: ArticleRepository = {
    async insert({ review, ...input }, compIds) {
      const time = stamp();
      const article: StoredArticle = {
        ...input,
        id: articles.length + 1,
        authorUsername: "",
        status: "queued",
        reviewerId: null,
        reviewedAt: null,
        reviewNote: null,
        compIds: [...compIds],
        createdAt: time,
        updatedAt: time,
        deletedAt: null,
      };
      applyReview(article, review);
      articles.push(article);
      return toRecord(article);
    },
    async update(id, input, { resetReview }, compIds) {
      const article = byId(id);
      Object.assign(article, input, { compIds: [...compIds], updatedAt: stamp() });
      if (resetReview) {
        applyReview(article, null);
      }
      return toRecord(article);
    },
    async findByPublicId(publicId) {
      const article = articles.find(
        (candidate) => candidate.publicId === publicId && !candidate.deletedAt,
      );
      return article ? toRecord(article) : null;
    },
    async softDelete(id, now) {
      byId(id).deletedAt = now;
    },
    async review(id, review) {
      const article = byId(id);
      applyReview(article, review);
      return toRecord(article);
    },
    async list(filter) {
      const matching = articles
        .filter(
          (article) =>
            !article.deletedAt &&
            (filter.status == null || article.status === filter.status) &&
            (filter.authorId == null || article.authorId === filter.authorId) &&
            (filter.setId == null || article.setId === filter.setId) &&
            (filter.category == null || article.category === filter.category) &&
            (filter.tag == null || article.tags.includes(filter.tag)),
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      return {
        total: matching.length,
        rows: matching.slice(filter.offset, filter.offset + filter.limit).map(toRecord),
      };
    },
    async setReaction(articleId, userId, kind) {
      const key = `${articleId}:${userId}`;
      if (kind) {
        reactions.set(key, kind);
      } else {
        reactions.delete(key);
      }
    },
    async reactions(articleId, userId) {
      const counts = Object.fromEntries(REACTION_KINDS.map((kind) => [kind, 0])) as ReactionCounts;
      for (const [key, kind] of reactions) {
        if (key.startsWith(`${articleId}:`)) {
          counts[kind] += 1;
        }
      }
      return {
        counts,
        mine: userId == null ? null : (reactions.get(`${articleId}:${userId}`) ?? null),
      };
    },
  };

  return { repository, articles };
}
