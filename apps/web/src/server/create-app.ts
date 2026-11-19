import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { type AuthRouteOptions, createAuthRoutes } from "./auth/routes";
import type { AuthService } from "./auth/service";

const REVALIDATABLE_TAG = /^(?:gamedata|snapshot:\d+|roles:\d+)$/;

export interface AppDependencies {
  revalidateSecret: () => string | undefined;
  revalidate: (tag: string, profile: "max") => void;
  databaseVersion: () => Promise<string | null>;
  auth?: { service: AuthService; options: AuthRouteOptions };
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

  if (dependencies.auth) {
    app.route("/", createAuthRoutes(dependencies.auth.service, dependencies.auth.options));
  }

  app.onError((error, c) => {
    console.error(error);
    return c.json({ ok: false }, 500);
  });

  return app;
}

export type AppType = ReturnType<typeof createApp>;
