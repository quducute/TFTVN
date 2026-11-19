import { z } from "zod";

export const ARTICLE_CATEGORIES = ["guide", "meta", "news", "other"] as const;
export const ARTICLE_STATUSES = ["queued", "approved", "rejected"] as const;
export const REACTION_KINDS = ["heart", "like", "dislike"] as const;
export const MAX_ARTICLE_TAGS = 5;
export const MAX_ARTICLE_COMPS = 5;
export const MIN_ARTICLE_TEXT = 20;
export const MAX_ARTICLE_HTML = 100_000;

export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];
export type ReactionKind = (typeof REACTION_KINDS)[number];

export const ARTICLE_ERROR_CODES = [
  "required",
  "titleTooShort",
  "titleTooLong",
  "bodyTooShort",
  "bodyTooLong",
  "categoryInvalid",
  "tagInvalid",
  "tooManyTags",
  "setInvalid",
  "tooManyComps",
  "compInvalid",
  "noteTooLong",
  "noteRequired",
  "reviewInvalid",
  "reactionInvalid",
  "articleNotFound",
  "notApproved",
  "forbidden",
  "unauthorized",
  "forbiddenOrigin",
  "rateLimited",
  "unknown",
] as const;

export type ArticleErrorCode = (typeof ARTICLE_ERROR_CODES)[number];
export type ArticleFieldErrors = Partial<Record<string, ArticleErrorCode>>;

const KNOWN_CODES = new Set<string>(ARTICLE_ERROR_CODES);
const required = { error: "required" } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, { error: "tagInvalid" })
  .max(24, { error: "tagInvalid" })
  .regex(/^[\p{L}\p{N}-]+$/u, { error: "tagInvalid" });

export const articleInputSchema = z.object({
  title: z
    .string(required)
    .trim()
    .min(5, { error: "titleTooShort" })
    .max(120, { error: "titleTooLong" }),
  category: z.enum(ARTICLE_CATEGORIES, { error: "categoryInvalid" }),
  setId: z
    .number({ error: "setInvalid" })
    .int({ error: "setInvalid" })
    .positive({ error: "setInvalid" })
    .nullish()
    .transform((value) => value ?? null),
  tags: z
    .array(tagSchema)
    .max(MAX_ARTICLE_TAGS, { error: "tooManyTags" })
    .default([])
    .transform((tags) => [...new Set(tags)]),
  body: z.string(required).max(MAX_ARTICLE_HTML, { error: "bodyTooLong" }),
  compIds: z
    .array(z.string().regex(UUID, { error: "compInvalid" }))
    .max(MAX_ARTICLE_COMPS, { error: "tooManyComps" })
    .default([])
    .transform((ids) => [...new Set(ids.map((id) => id.toLowerCase()))]),
});

export type ArticleInput = z.infer<typeof articleInputSchema>;

export const articleReviewSchema = z
  .object({
    status: z.enum(["approved", "rejected"], { error: "reviewInvalid" }),
    note: z
      .string()
      .trim()
      .max(500, { error: "noteTooLong" })
      .nullish()
      .transform((value) => value || null),
  })
  .refine((value) => value.status === "approved" || value.note != null, {
    path: ["note"],
    message: "noteRequired",
  });

export const reactionSchema = z.object({
  kind: z.enum(REACTION_KINDS, { error: "reactionInvalid" }).nullable(),
});

export function toArticleFieldErrors(error: z.ZodError): ArticleFieldErrors {
  const errors: ArticleFieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (errors[field] == null) {
      errors[field] = KNOWN_CODES.has(issue.message)
        ? (issue.message as ArticleErrorCode)
        : "unknown";
    }
  }
  return errors;
}
