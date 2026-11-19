import { expect, test } from "@playwright/test";
import { createApp } from "../create-app";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./routes";
import { VALID_ACCOUNT, createTestAuth } from "./testing";

const ORIGIN = "http://localhost";

function setup() {
  const auth = createTestAuth();
  const app = createApp({
    revalidateSecret: () => undefined,
    revalidate: () => {},
    databaseVersion: async () => null,
    auth: { service: auth.service, options: { secureCookies: true } },
  });
  let jar: Record<string, string> = {};

  const send = async (
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    const cookie = Object.entries(jar)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
    const response = await app.request(`${ORIGIN}${path}`, {
      method,
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const [name, value] = pair!.split("=");
      if (/Max-Age=0/i.test(line) || value === "") {
        delete jar[name!];
      } else {
        jar[name!] = value!;
      }
    }
    return response;
  };

  return { auth, send, cookies: () => jar, clearCookies: () => (jar = {}) };
}

test.describe("auth routes", () => {
  test("blocks writes without a matching Origin header", async () => {
    const { send } = setup();
    const missing = await send("POST", "/api/auth/register", VALID_ACCOUNT, { origin: "" });
    expect(missing.status).toBe(403);
    const foreign = await send("POST", "/api/auth/register", VALID_ACCOUNT, {
      origin: "https://evil.example",
    });
    expect(foreign.status).toBe(403);
    expect(await foreign.json()).toMatchObject({ ok: false, code: "forbiddenOrigin" });
  });

  test("register sets httpOnly cookies scoped as designed", async () => {
    const { send } = setup();
    const response = await send("POST", "/api/auth/register", VALID_ACCOUNT);
    expect(response.status).toBe(201);
    const cookies = response.headers.getSetCookie();
    const access = cookies.find((line) => line.startsWith(`${ACCESS_COOKIE}=`))!;
    const refresh = cookies.find((line) => line.startsWith(`${REFRESH_COOKIE}=`))!;
    expect(access).toMatch(/HttpOnly/);
    expect(access).toMatch(/Secure/);
    expect(access).toMatch(/SameSite=Lax/);
    expect(access).toMatch(/Path=\//);
    expect(refresh).toMatch(/Path=\/api/);
    expect(refresh).toMatch(/Max-Age=2592000/);
  });

  test("me needs a valid access cookie", async () => {
    const { send, clearCookies } = setup();
    await send("POST", "/api/auth/register", VALID_ACCOUNT);
    const me = await send("GET", "/api/auth/me");
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ ok: true, user: { username: "qudu_18" } });
    clearCookies();
    expect((await send("GET", "/api/auth/me")).status).toBe(401);
  });

  test("refresh issues new cookies and logout clears them", async () => {
    const { send, cookies } = setup();
    await send("POST", "/api/auth/register", VALID_ACCOUNT);
    const before = cookies()[REFRESH_COOKIE];
    expect((await send("POST", "/api/auth/refresh")).status).toBe(200);
    expect(cookies()[REFRESH_COOKIE]).not.toBe(before);

    expect((await send("POST", "/api/auth/logout")).status).toBe(200);
    expect(cookies()[ACCESS_COOKIE]).toBeUndefined();
    expect((await send("POST", "/api/auth/refresh")).status).toBe(401);
  });

  test("maps service errors to HTTP status and field codes", async () => {
    const { send } = setup();
    const response = await send("POST", "/api/auth/register", {
      username: "x",
      email: "bad",
      password: "1",
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      fields: { username: "usernameTooShort", email: "emailInvalid", password: "passwordTooShort" },
    });
  });

  test("profile routes require login", async () => {
    const { send } = setup();
    expect((await send("PATCH", "/api/users/me", { username: "abc" })).status).toBe(401);
    expect(
      (await send("PUT", "/api/users/me/riot", { gameName: "Abc", tagLine: "VN2" })).status,
    ).toBe(401);
  });

  test("a logged in user can update the profile and link a Riot ID", async () => {
    const { send } = setup();
    await send("POST", "/api/auth/register", VALID_ACCOUNT);
    const updated = await send("PATCH", "/api/users/me", { username: "duc_new" });
    expect(await updated.json()).toMatchObject({ ok: true, user: { username: "duc_new" } });
    const me = await send("GET", "/api/auth/me");
    expect(await me.json()).toMatchObject({ user: { username: "duc_new" } });
    const linked = await send("PUT", "/api/users/me/riot", { gameName: "Quý Đức", tagLine: "VN2" });
    expect(await linked.json()).toMatchObject({
      user: { riot: { gameName: "Quý Đức", verified: false } },
    });
  });
});
