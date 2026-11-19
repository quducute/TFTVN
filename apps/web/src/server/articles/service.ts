import {
  type ArticleErrorCode,
  type ArticleFieldErrors,
  MAX_ARTICLE_HTML,
  MIN_ARTICLE_TEXT,
  articleInputSchema,
  articleReviewSchema,
  reactionSchema,
  toArticleFieldErrors,
} from "@tftvn/core";
import { plainText, sanitizeArticleHtml } from "./sanitize";
import type {
  ArticleActor,
  ArticleContent,
  ArticleListFilter,
  ArticleRecord,
  ArticleRepository,
  ArticleResult,
  PublicArticle,
  ReactionCounts,
} from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ArticleServiceDependencies {
  repository: ArticleRepository;
  setExists: (setId: number) => Promise<boolean>;
  resolveComps: (publicIds: string[]) => Promise<Map<string, number>>;
  newPublicId: () => string;
  now: () => Date;
}

const fail = (
  status: 400 | 401 | 403 | 404 | 409,
  code: ArticleErrorCode,
  fields?: ArticleFieldErrors,
): ArticleResult<never> => ({ ok: false, status, code, fields });

export function toPublicArticle(record: ArticleRecord): PublicArticle {
  const article: Partial<ArticleRecord> = { ...record };
  delete article.id;
  return article as PublicArticle;
}

export const canManage = (actor: ArticleActor | null, article: ArticleRecord) =>
  actor != null && (actor.id === article.authorId || actor.role === "admin");

export const canView = (actor: ArticleActor | null, article: ArticleRecord) =>
  article.status === "approved" || canManage(actor, article);

export function createArticleService({
  repository,
  setExists,
  resolveComps,
  newPublicId,
  now,
}: ArticleServiceDependencies) {
  const validate = async (
    input: unknown,
  ): Promise<ArticleResult<{ content: ArticleContent; compIds: number[] }>> => {
    const parsed = articleInputSchema.safeParse(input);
    if (!parsed.success) {
      const fields = toArticleFieldErrors(parsed.error);
      return fail(400, Object.values(fields)[0] ?? "unknown", fields);
    }
    const { compIds: publicCompIds, ...value } = parsed.data;
    const body = sanitizeArticleHtml(value.body);
    if (plainText(body).length < MIN_ARTICLE_TEXT) {
      return fail(400, "bodyTooShort", { body: "bodyTooShort" });
    }
    if (body.length > MAX_ARTICLE_HTML) {
      return fail(400, "bodyTooLong", { body: "bodyTooLong" });
    }
    if (value.setId != null && !(await setExists(value.setId))) {
      return fail(400, "setInvalid", { setId: "setInvalid" });
    }
    const comps = publicCompIds.length > 0 ? await resolveComps(publicCompIds) : new Map();
    if (publicCompIds.some((id) => !comps.has(id))) {
      return fail(400, "compInvalid", { compIds: "compInvalid" });
    }
    return {
      ok: true,
      value: {
        content: { ...value, body },
        compIds: publicCompIds.map((id) => comps.get(id)!),
      },
    };
  };

  const find = async (publicId: string) =>
    UUID.test(publicId) ? repository.findByPublicId(publicId.toLowerCase()) : null;

  const findManaged = async (
    actor: ArticleActor,
    publicId: string,
  ): Promise<ArticleResult<ArticleRecord>> => {
    const article = await find(publicId);
    if (!article || !canView(actor, article)) {
      return fail(404, "articleNotFound");
    }
    if (!canManage(actor, article)) {
      return fail(403, "forbidden");
    }
    return { ok: true, value: article };
  };

  const findApproved = async (publicId: string): Promise<ArticleResult<ArticleRecord>> => {
    const article = await find(publicId);
    if (!article) {
      return fail(404, "articleNotFound");
    }
    if (article.status !== "approved") {
      return fail(409, "notApproved");
    }
    return { ok: true, value: article };
  };

  return {
    find,

    list(filter: ArticleListFilter) {
      return repository.list(filter);
    },

    async get(actor: ArticleActor | null, publicId: string): Promise<ArticleResult<ArticleRecord>> {
      const article = await find(publicId);
      return article && canView(actor, article)
        ? { ok: true, value: article }
        : fail(404, "articleNotFound");
    },

    async create(actor: ArticleActor, input: unknown): Promise<ArticleResult<ArticleRecord>> {
      const valid = await validate(input);
      if (!valid.ok) {
        return valid;
      }
      const review =
        actor.role === "admin"
          ? { status: "approved" as const, reviewerId: actor.id, note: null, now: now() }
          : null;
      const article = await repository.insert(
        { ...valid.value.content, publicId: newPublicId(), authorId: actor.id, review },
        valid.value.compIds,
      );
      return { ok: true, value: article };
    },

    async update(
      actor: ArticleActor,
      publicId: string,
      input: unknown,
    ): Promise<ArticleResult<ArticleRecord>> {
      const existing = await findManaged(actor, publicId);
      if (!existing.ok) {
        return existing;
      }
      const valid = await validate(input);
      if (!valid.ok) {
        return valid;
      }
      const article = await repository.update(
        existing.value.id,
        valid.value.content,
        { resetReview: actor.role !== "admin" },
        valid.value.compIds,
      );
      return { ok: true, value: article };
    },

    async remove(actor: ArticleActor, publicId: string): Promise<ArticleResult<ArticleRecord>> {
      const existing = await findManaged(actor, publicId);
      if (!existing.ok) {
        return existing;
      }
      await repository.softDelete(existing.value.id, now());
      return existing;
    },

    async review(
      actor: ArticleActor,
      publicId: string,
      input: unknown,
    ): Promise<ArticleResult<ArticleRecord>> {
      if (actor.role !== "admin") {
        return fail(403, "forbidden");
      }
      const parsed = articleReviewSchema.safeParse(input);
      if (!parsed.success) {
        const fields = toArticleFieldErrors(parsed.error);
        return fail(400, Object.values(fields)[0] ?? "reviewInvalid", fields);
      }
      const article = await find(publicId);
      if (!article) {
        return fail(404, "articleNotFound");
      }
      return {
        ok: true,
        value: await repository.review(article.id, {
          ...parsed.data,
          reviewerId: actor.id,
          now: now(),
        }),
      };
    },

    async reactions(
      actor: ArticleActor | null,
      publicId: string,
    ): Promise<ArticleResult<{ counts: ReactionCounts; mine: string | null }>> {
      const article = await findApproved(publicId);
      if (!article.ok) {
        return article;
      }
      return { ok: true, value: await repository.reactions(article.value.id, actor?.id ?? null) };
    },

    async react(
      actor: ArticleActor,
      publicId: string,
      input: unknown,
    ): Promise<ArticleResult<{ counts: ReactionCounts; mine: string | null }>> {
      const parsed = reactionSchema.safeParse(input);
      if (!parsed.success) {
        return fail(400, "reactionInvalid", { kind: "reactionInvalid" });
      }
      const article = await findApproved(publicId);
      if (!article.ok) {
        return article;
      }
      await repository.setReaction(article.value.id, actor.id, parsed.data.kind);
      return { ok: true, value: await repository.reactions(article.value.id, actor.id) };
    },
  };
}

export type ArticleService = ReturnType<typeof createArticleService>;
