import { type Context, Hono } from "hono";
import type { AuthEnv, Guards } from "../auth/guards";
import { rolesTag } from "../cache-tags";
import type { AdminResult, AdminService } from "./service";

export function createAdminRoutes({
  service,
  guards,
  expireTag,
}: {
  service: AdminService;
  guards: Guards;
  expireTag: (tag: string) => void;
}) {
  const readBody = (c: Context) => c.req.json<unknown>().catch(() => ({}));
  const respond = <Value extends { setId: number }>(c: Context, result: AdminResult<Value>) => {
    if (!result.ok) {
      return c.json({ ok: false, code: result.code, fields: {} }, result.status);
    }
    expireTag(rolesTag(result.value.setId));
    return c.json({ ok: true, ...result.value });
  };

  return new Hono<AuthEnv>()
    .use("/admin/*", guards.sameOrigin)
    .use("/admin/*", guards.requireAdmin)
    .put("/admin/users/:user/role", async (c) => {
      const result = await service.setUserRole(
        c.get("user").id,
        c.req.param("user"),
        await readBody(c),
      );
      return result.ok
        ? c.json({ ok: true, ...result.value })
        : c.json({ ok: false, code: result.code, fields: {} }, result.status);
    })
    .put("/admin/sets/:set/champions/:champion/role", async (c) =>
      respond(
        c,
        await service.setChampionRole(
          c.get("user").id,
          c.req.param("set"),
          c.req.param("champion"),
          await readBody(c),
        ),
      ),
    )
    .put("/admin/sets/:set/roles/:role/items", async (c) =>
      respond(
        c,
        await service.setRoleItems(
          c.get("user").id,
          c.req.param("set"),
          c.req.param("role"),
          await readBody(c),
        ),
      ),
    );
}
