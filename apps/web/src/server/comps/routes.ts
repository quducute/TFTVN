import { type Context, Hono } from "hono";
import { getCookie } from "hono/cookie";
import { ACCESS_COOKIE, type AuthEnv, type Guards } from "../auth/guards";
import type { UserRecord } from "../auth/types";
import { type CompService, toPublicComp } from "./service";
import type { CompRecord, CompResult } from "./types";

export const COMPS_TAG = "comps";
export const compTag = (publicId: string) => `comp:${publicId}`;

type Failure = Extract<CompResult<unknown>, { ok: false }>;

export interface CompRouteDependencies {
  service: CompService;
  guards: Guards;
  currentUser: (accessToken: string | undefined) => Promise<UserRecord | null>;
  expireTag: (tag: string) => void;
}

export function createCompRoutes({
  service,
  guards,
  currentUser,
  expireTag,
}: CompRouteDependencies) {
  const readBody = (c: Context) => c.req.json<unknown>().catch(() => ({}));
  const failure = (c: Context, result: Failure) =>
    c.json({ ok: false, code: result.code, fields: result.fields ?? {} }, result.status);
  const changed = (comp: CompRecord) => {
    expireTag(COMPS_TAG);
    expireTag(compTag(comp.publicId));
  };
  const compResponse = (c: Context, result: CompResult<CompRecord>, status: 200 | 201 = 200) => {
    if (!result.ok) {
      return failure(c, result);
    }
    changed(result.value);
    return c.json({ ok: true, comp: toPublicComp(result.value) }, status);
  };

  return new Hono<AuthEnv>()
    .use("/comps", guards.sameOrigin)
    .use("/comps/*", guards.sameOrigin)
    .post("/comps", guards.requireUser, async (c) =>
      compResponse(c, await service.create(c.get("user"), await readBody(c)), 201),
    )
    .get("/comps/:id", async (c) => {
      const comp = await service.find(c.req.param("id"));
      return comp
        ? c.json({ ok: true, comp: toPublicComp(comp) })
        : c.json({ ok: false, code: "compNotFound", fields: {} }, 404);
    })
    .put("/comps/:id", guards.requireUser, async (c) =>
      compResponse(c, await service.update(c.get("user"), c.req.param("id"), await readBody(c))),
    )
    .delete("/comps/:id", guards.requireUser, async (c) => {
      const result = await service.remove(c.get("user"), c.req.param("id"));
      if (!result.ok) {
        return failure(c, result);
      }
      changed(result.value);
      return c.json({ ok: true });
    })
    .put("/comps/:id/meta", guards.requireAdmin, async (c) =>
      compResponse(c, await service.setMeta(c.get("user"), c.req.param("id"), await readBody(c))),
    )
    .get("/comps/:id/bookmark", async (c) => {
      const user = await currentUser(getCookie(c, ACCESS_COOKIE));
      const result = await service.bookmarkState(user, c.req.param("id"));
      return result.ok ? c.json({ ok: true, ...result.value }) : failure(c, result);
    })
    .put("/comps/:id/bookmark", guards.requireUser, async (c) => {
      const result = await service.setBookmark(c.get("user"), c.req.param("id"), true);
      return result.ok ? c.json({ ok: true, ...result.value }) : failure(c, result);
    })
    .delete("/comps/:id/bookmark", guards.requireUser, async (c) => {
      const result = await service.setBookmark(c.get("user"), c.req.param("id"), false);
      return result.ok ? c.json({ ok: true, ...result.value }) : failure(c, result);
    });
}
