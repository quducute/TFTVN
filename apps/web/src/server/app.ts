import { Hono } from "hono";
import { getDatabaseVersion } from "./status";

export const app = new Hono()
  .basePath("/api")
  .get("/health", (c) => c.json({ ok: true }))
  .get("/health/db", async (c) => c.json({ ok: true, version: await getDatabaseVersion() }));

app.onError((error, c) => {
  console.error(error);
  return c.json({ ok: false }, 500);
});

export type AppType = typeof app;
