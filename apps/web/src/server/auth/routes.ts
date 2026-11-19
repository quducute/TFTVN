import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { ACCESS_TOKEN_SECONDS, REFRESH_TOKEN_SECONDS } from "./crypto";
import { type AuthService, toPublicUser } from "./service";
import { ACCESS_COOKIE, type AuthEnv, REFRESH_COOKIE, createGuards } from "./guards";
import type { ServiceResult, Session } from "./types";

export { ACCESS_COOKIE, REFRESH_COOKIE } from "./guards";

export interface AuthRouteOptions {
  secureCookies: boolean;
  allowedOrigins?: string[];
}

type Failure = Extract<ServiceResult<unknown>, { ok: false }>;

export function createAuthRoutes(service: AuthService, options: AuthRouteOptions) {
  const { sameOrigin, requireUser } = createGuards(
    (token) => service.currentUser(token),
    options.allowedOrigins,
  );
  const cookieBase = { httpOnly: true, secure: options.secureCookies, sameSite: "Lax" as const };

  const setSession = (
    c: Context,
    session: Pick<Session, "accessToken"> & { refreshToken?: string },
  ) => {
    setCookie(c, ACCESS_COOKIE, session.accessToken, {
      ...cookieBase,
      path: "/",
      maxAge: ACCESS_TOKEN_SECONDS,
    });
    if (session.refreshToken) {
      setCookie(c, REFRESH_COOKIE, session.refreshToken, {
        ...cookieBase,
        path: "/api",
        maxAge: REFRESH_TOKEN_SECONDS,
      });
    }
  };

  const clearSession = (c: Context) => {
    deleteCookie(c, ACCESS_COOKIE, { ...cookieBase, path: "/" });
    deleteCookie(c, REFRESH_COOKIE, { ...cookieBase, path: "/api" });
  };

  const clientKey = (c: Context) =>
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "local";

  const readBody = (c: Context) => c.req.json<unknown>().catch(() => ({}));

  const failure = (c: Context, result: Failure) =>
    c.json({ ok: false, code: result.code, fields: result.fields ?? {} }, result.status);

  return new Hono<AuthEnv>()
    .use("/auth/*", sameOrigin)
    .use("/users/*", sameOrigin)
    .post("/auth/register", async (c) => {
      const result = await service.register(await readBody(c), clientKey(c));
      if (!result.ok) {
        return failure(c, result);
      }
      setSession(c, result.value);
      return c.json({ ok: true, user: result.value.user }, 201);
    })
    .post("/auth/login", async (c) => {
      const result = await service.login(await readBody(c), clientKey(c));
      if (!result.ok) {
        return failure(c, result);
      }
      setSession(c, result.value);
      return c.json({ ok: true, user: result.value.user });
    })
    .post("/auth/refresh", async (c) => {
      const result = await service.refresh(getCookie(c, REFRESH_COOKIE));
      if (!result.ok) {
        clearSession(c);
        return failure(c, result);
      }
      setSession(c, result.value);
      return c.json({ ok: true, user: result.value.user });
    })
    .post("/auth/logout", async (c) => {
      await service.logout(getCookie(c, REFRESH_COOKIE));
      clearSession(c);
      return c.json({ ok: true });
    })
    .get("/auth/me", requireUser, (c) => c.json({ ok: true, user: toPublicUser(c.get("user")) }))
    .get("/auth/session", async (c) => {
      const user = await service.currentUser(getCookie(c, ACCESS_COOKIE));
      if (user) {
        return c.json({ ok: true, user: toPublicUser(user) });
      }
      const refreshToken = getCookie(c, REFRESH_COOKIE);
      if (!refreshToken) {
        return c.json({ ok: true, user: null });
      }
      const result = await service.refresh(refreshToken);
      if (!result.ok) {
        clearSession(c);
        return c.json({ ok: true, user: null });
      }
      setSession(c, result.value);
      return c.json({ ok: true, user: result.value.user });
    })
    .post("/auth/forgot-password", async (c) => {
      const result = await service.forgotPassword(
        await readBody(c),
        clientKey(c),
        new URL(c.req.url).origin,
      );
      return result.ok ? c.json({ ok: true }) : failure(c, result);
    })
    .post("/auth/reset-password", async (c) => {
      const result = await service.resetPassword(await readBody(c));
      if (!result.ok) {
        return failure(c, result);
      }
      clearSession(c);
      return c.json({ ok: true });
    })
    .patch("/users/me", requireUser, async (c) => {
      const result = await service.updateProfile(c.get("user"), await readBody(c));
      if (!result.ok) {
        return failure(c, result);
      }
      setSession(c, { accessToken: result.value.accessToken });
      return c.json({ ok: true, user: result.value.user });
    })
    .post("/users/me/password", requireUser, async (c) => {
      const result = await service.changePassword(
        c.get("user"),
        await readBody(c),
        getCookie(c, REFRESH_COOKIE),
      );
      return result.ok ? c.json({ ok: true }) : failure(c, result);
    })
    .put("/users/me/riot", requireUser, async (c) => {
      const result = await service.linkRiot(c.get("user"), await readBody(c));
      return result.ok ? c.json({ ok: true, user: result.value }) : failure(c, result);
    })
    .delete("/users/me/riot", requireUser, async (c) =>
      c.json({ ok: true, user: await service.unlinkRiot(c.get("user")) }),
    );
}
