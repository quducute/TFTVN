import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { type AuthRouteOptions, createAuthRoutes } from "./auth/routes";
import { createAdminRoutes } from "./admin/routes";
import type { AdminService } from "./admin/service";
import { createArticleRoutes } from "./articles/routes";
import type { ArticleService } from "./articles/service";
import { type HitRateLimit, createGuards } from "./auth/guards";
import type { AuthService } from "./auth/service";
import { createCompRoutes } from "./comps/routes";
import type { CompService } from "./comps/service";

const REVALIDATABLE_TAG = /^(?:gamedata|stats|snapshot:\d+|roles:\d+)$/;

export interface AppDependencies {
  revalidateSecret: () => string | undefined;
  revalidate: (tag: string, profile: "max") => void;
  databaseVersion: () => Promise<string | null>;
  hitRateLimit?: HitRateLimit;
  auth?: { service: AuthService; options: AuthRouteOptions };
  comps?: { service: CompService; expireTag: (tag: string) => void };
  articles?: { service: ArticleService; expireTag: (tag: string) => void };
  admin?: { service: AdminService; expireTag: (tag: string) => void };
}

function hasValidSecret(secret: string | undefined, header: string | undefined): boolean {
  if (!secret || !header) {
    return false;
  }
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function createApp(dependencies: AppDependencies) {
  const app = new Hono()
    .basePath("/api")
    .get("/health", (c) => c.json({ ok: true }))
    .get("/health/db", async (c) =>
      c.json({ ok: true, version: await dependencies.databaseVersion() }),
    )
    .post("/revalidate", async (c) => {
      if (!hasValidSecret(dependencies.revalidateSecret(), c.req.header("authorization"))) {
        return c.json({ ok: false }, 401);
      }
      const body = await c.req.json<{ tag?: unknown }>().catch(() => ({ tag: undefined }));
      const tag = typeof body.tag === "string" ? body.tag : "";
      if (!REVALIDATABLE_TAG.test(tag)) {
        return c.json({ ok: false }, 400);
      }
      dependencies.revalidate(tag, "max");
      return c.json({ ok: true, tag });
    });

  const { auth, comps, articles, admin } = dependencies;
  if (auth) {
    app.route("/", createAuthRoutes(auth.service, auth.options));
    const currentUser = (token: string | undefined) => auth.service.currentUser(token);
    const guards = createGuards(
      currentUser,
      auth.options.allowedOrigins,
      dependencies.hitRateLimit,
    );
    if (comps) {
      app.route(
        "/",
        createCompRoutes({
          service: comps.service,
          guards,
          currentUser,
          expireTag: comps.expireTag,
        }),
      );
    }
    if (articles) {
      app.route(
        "/",
        createArticleRoutes({
          service: articles.service,
          guards,
          currentUser,
          expireTag: articles.expireTag,
        }),
      );
    }
    if (admin) {
      app.route(
        "/",
        createAdminRoutes({ service: admin.service, guards, expireTag: admin.expireTag }),
      );
    }
  }

  app.onError((error, c) => {
    console.error(error);
    return c.json({ ok: false }, 500);
  });

  return app;
}

export type AppType = ReturnType<typeof createApp>;
