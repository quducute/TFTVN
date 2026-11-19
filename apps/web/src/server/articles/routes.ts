import { type Context, Hono } from "hono";
import { getCookie } from "hono/cookie";
import { ACCESS_COOKIE, type AuthEnv, type Guards } from "../auth/guards";
import type { UserRecord } from "../auth/types";
import { type ArticleService, toPublicArticle } from "./service";
import type { ArticleRecord, ArticleResult } from "./types";

export const ARTICLES_TAG = "articles";
export const articleTag = (publicId: string) => `article:${publicId}`;

type Failure = Extract<ArticleResult<unknown>, { ok: false }>;

export interface ArticleRouteDependencies {
  service: ArticleService;
  guards: Guards;
  currentUser: (accessToken: string | undefined) => Promise<UserRecord | null>;
  expireTag: (tag: string) => void;
}

export function createArticleRoutes({
  service,
  guards,
  currentUser,
  expireTag,
}: ArticleRouteDependencies) {
  const readBody = (c: Context) => c.req.json<unknown>().catch(() => ({}));
  const optionalUser = (c: Context) => currentUser(getCookie(c, ACCESS_COOKIE));
  const failure = (c: Context, result: Failure) =>
    c.json({ ok: false, code: result.code, fields: result.fields ?? {} }, result.status);
  const respond = (c: Context, result: ArticleResult<ArticleRecord>, status: 200 | 201 = 200) => {
    if (!result.ok) {
      return failure(c, result);
    }
    expireTag(ARTICLES_TAG);
    expireTag(articleTag(result.value.publicId));
    return c.json({ ok: true, article: toPublicArticle(result.value) }, status);
  };

  return new Hono<AuthEnv>()
    .use("/articles", guards.sameOrigin)
    .use("/articles/*", guards.sameOrigin)
    .post("/articles", guards.requireUser, async (c) =>
      respond(c, await service.create(c.get("user"), await readBody(c)), 201),
    )
    .get("/articles/:id", async (c) => {
      const result = await service.get(await optionalUser(c), c.req.param("id"));
      return result.ok
        ? c.json({ ok: true, article: toPublicArticle(result.value) })
        : failure(c, result);
    })
    .put("/articles/:id", guards.requireUser, async (c) =>
      respond(c, await service.update(c.get("user"), c.req.param("id"), await readBody(c))),
    )
    .delete("/articles/:id", guards.requireUser, async (c) => {
      const result = await service.remove(c.get("user"), c.req.param("id"));
      if (!result.ok) {
        return failure(c, result);
      }
      expireTag(ARTICLES_TAG);
      expireTag(articleTag(result.value.publicId));
      return c.json({ ok: true });
    })
    .put("/articles/:id/review", guards.requireAdmin, async (c) =>
      respond(c, await service.review(c.get("user"), c.req.param("id"), await readBody(c))),
    )
    .get("/articles/:id/reactions", async (c) => {
      const result = await service.reactions(await optionalUser(c), c.req.param("id"));
      return result.ok ? c.json({ ok: true, ...result.value }) : failure(c, result);
    })
    .put("/articles/:id/reaction", guards.requireUser, async (c) => {
      const result = await service.react(c.get("user"), c.req.param("id"), await readBody(c));
      return result.ok ? c.json({ ok: true, ...result.value }) : failure(c, result);
    });
}
