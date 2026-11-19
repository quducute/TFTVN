import { expect, test } from "@playwright/test";
import { createApp } from "./create-app";

function setup(secret: string | undefined = "s3cret") {
  const revalidated: [string, string][] = [];
  const app = createApp({
    revalidateSecret: () => secret,
    revalidate: (tag, profile) => {
      revalidated.push([tag, profile]);
    },
    databaseVersion: async () => "18.7",
  });
  const revalidate = (body: unknown, authorization?: string) =>
    app.request("/api/revalidate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authorization ? { authorization } : {}),
      },
      body: JSON.stringify(body),
    });
  return { app, revalidate, revalidated };
}

test.describe("api", () => {
  test("GET /api/health returns ok", async () => {
    const response = await setup().app.request("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  test("GET /api/health/db reports the database version", async () => {
    const response = await setup().app.request("/api/health/db");
    expect(await response.json()).toEqual({ ok: true, version: "18.7" });
  });

  test("unknown route returns 404", async () => {
    const response = await setup().app.request("/api/does-not-exist");
    expect(response.status).toBe(404);
  });

  test("rejects revalidation without the secret", async () => {
    const { revalidate, revalidated } = setup();
    expect((await revalidate({ tag: "gamedata" })).status).toBe(401);
    expect((await revalidate({ tag: "gamedata" }, "Bearer wrong")).status).toBe(401);
    expect(revalidated).toEqual([]);
  });

  test("rejects revalidation when no secret is configured", async () => {
    const { revalidate, revalidated } = setup(undefined);
    expect((await revalidate({ tag: "gamedata" }, "Bearer ")).status).toBe(401);
    expect(revalidated).toEqual([]);
  });

  test("rejects tags outside the allow list", async () => {
    const { revalidate, revalidated } = setup();
    expect((await revalidate({ tag: "anything" }, "Bearer s3cret")).status).toBe(400);
    expect((await revalidate("not json", "Bearer s3cret")).status).toBe(400);
    expect(revalidated).toEqual([]);
  });

  test("revalidates an allowed tag with the max profile", async () => {
    const { revalidate, revalidated } = setup();
    const response = await revalidate({ tag: "roles:18" }, "Bearer s3cret");
    expect(response.status).toBe(200);
    expect(revalidated).toEqual([["roles:18", "max"]]);
  });
});
