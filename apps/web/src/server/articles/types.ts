import type {
  ArticleCategory,
  ArticleErrorCode,
  ArticleFieldErrors,
  ArticleStatus,
  ReactionKind,
} from "@tftvn/core";

export interface ArticleContent {
  title: string;
  category: ArticleCategory;
  setId: number | null;
  tags: string[];
  body: string;
}

export interface ArticleRecord extends ArticleContent {
  id: number;
  publicId: string;
  authorId: number;
  authorUsername: string;
  status: ArticleStatus;
  reviewerUsername: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  compIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type PublicArticle = Omit<ArticleRecord, "id">;

export interface ArticleListFilter {
  status?: ArticleStatus;
  authorId?: number;
  setId?: number;
  category?: ArticleCategory;
  tag?: string;
  limit: number;
  offset: number;
}

export interface ArticleReview {
  status: "approved" | "rejected";
  reviewerId: number;
  note: string | null;
  now: Date;
}

export type ReactionCounts = Record<ReactionKind, number>;

export interface ArticleRepository {
  insert(
    input: ArticleContent & { publicId: string; authorId: number; review: ArticleReview | null },
    compIds: number[],
  ): Promise<ArticleRecord>;
  update(
    id: number,
    input: ArticleContent,
    options: { resetReview: boolean },
    compIds: number[],
  ): Promise<ArticleRecord>;
  findByPublicId(publicId: string): Promise<ArticleRecord | null>;
  softDelete(id: number, now: Date): Promise<void>;
  review(id: number, review: ArticleReview): Promise<ArticleRecord>;
  list(filter: ArticleListFilter): Promise<{ rows: ArticleRecord[]; total: number }>;
  setReaction(articleId: number, userId: number, kind: ReactionKind | null): Promise<void>;
  reactions(
    articleId: number,
    userId: number | null,
  ): Promise<{ counts: ReactionCounts; mine: ReactionKind | null }>;
}

export type ArticleResult<Value> =
  | { ok: true; value: Value }
  | {
      ok: false;
      status: 400 | 401 | 403 | 404 | 409;
      code: ArticleErrorCode;
      fields?: ArticleFieldErrors;
    };

export interface ArticleActor {
  id: number;
  role: "user" | "admin";
}
