import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { UserRecord } from "./types";

export const ACCESS_COOKIE = "tftvn_access";
export const REFRESH_COOKIE = "tftvn_refresh";

export type AuthEnv = { Variables: { user: UserRecord } };

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const deny = (code: "forbiddenOrigin" | "unauthorized" | "forbidden") => ({
  ok: false as const,
  code,
  fields: {},
});

export function createGuards(
  currentUser: (accessToken: string | undefined) => Promise<UserRecord | null>,
  allowedOrigins: readonly string[] = [],
) {
  const origins = new Set(allowedOrigins);

  const sameOrigin = createMiddleware(async (c, next) => {
    if (!SAFE_METHODS.has(c.req.method)) {
      const origin = c.req.header("origin");
      const ownOrigin = new URL(c.req.url).origin;
      if (!origin || (origin !== ownOrigin && !origins.has(origin))) {
        return c.json(deny("forbiddenOrigin"), 403);
      }
    }
    await next();
  });

  const requireUser = createMiddleware<AuthEnv>(async (c, next) => {
    const user = await currentUser(getCookie(c, ACCESS_COOKIE));
    if (!user) {
      return c.json(deny("unauthorized"), 401);
    }
    c.set("user", user);
    await next();
  });

  const requireAdmin = createMiddleware<AuthEnv>(async (c, next) => {
    const user = await currentUser(getCookie(c, ACCESS_COOKIE));
    if (!user) {
      return c.json(deny("unauthorized"), 401);
    }
    if (user.role !== "admin") {
      return c.json(deny("forbidden"), 403);
    }
    c.set("user", user);
    await next();
  });

  return { sameOrigin, requireUser, requireAdmin };
}

export type Guards = ReturnType<typeof createGuards>;
