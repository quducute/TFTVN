import type { ArticleCategory, ArticleStatus } from "@tftvn/core";
import { cacheLife, cacheTag } from "next/cache";
import { createDbArticleRepository } from "./db-repository";
import { ARTICLES_TAG, articleTag } from "./routes";
import { excerpt } from "./sanitize";
import { toPublicArticle } from "./service";
import type { ArticleListFilter, PublicArticle } from "./types";

export const ARTICLE_PAGE_SIZE = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const repository = createDbArticleRepository();

export type ArticleSummary = Omit<PublicArticle, "body"> & { excerpt: string };

export interface ArticlePage {
  rows: ArticleSummary[];
  total: number;
  page: number;
  pages: number;
}

const summarize = (article: PublicArticle): ArticleSummary => {
  const summary: Partial<PublicArticle> & { excerpt: string } = {
    ...article,
    excerpt: excerpt(article.body),
  };
  delete summary.body;
  return summary as ArticleSummary;
};

async function listPage(
  filter: Omit<ArticleListFilter, "limit" | "offset">,
  page: number,
): Promise<ArticlePage> {
  const current = Math.max(1, Math.trunc(page) || 1);
  const result = await repository.list({
    ...filter,
    limit: ARTICLE_PAGE_SIZE,
    offset: (current - 1) * ARTICLE_PAGE_SIZE,
  });
  return {
    rows: result.rows.map((row) => summarize(toPublicArticle(row))),
    total: result.total,
    page: current,
    pages: Math.max(1, Math.ceil(result.total / ARTICLE_PAGE_SIZE)),
  };
}

async function cachedArticle(publicId: string): Promise<PublicArticle | null> {
  "use cache";
  cacheLife("max");
  cacheTag(ARTICLES_TAG, articleTag(publicId));
  const article = await repository.findByPublicId(publicId);
  return article ? toPublicArticle(article) : null;
}

export async function getArticle(publicId: string): Promise<PublicArticle | null> {
  return UUID.test(publicId) ? cachedArticle(publicId.toLowerCase()) : null;
}

export async function getApprovedArticles(filter: {
  category: ArticleCategory | null;
  tag: string | null;
  page: number;
}): Promise<ArticlePage> {
  "use cache";
  cacheLife("max");
  cacheTag(ARTICLES_TAG);
  return listPage(
    {
      status: "approved",
      category: filter.category ?? undefined,
      tag: filter.tag ?? undefined,
    },
    filter.page,
  );
}

export function getAuthoredArticles(authorId: number, page: number): Promise<ArticlePage> {
  return listPage({ authorId }, page);
}

export function getArticlesByStatus(status: ArticleStatus, page: number): Promise<ArticlePage> {
  return listPage({ status }, page);
}
