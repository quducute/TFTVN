import { expect, test } from "@playwright/test";
import { createTestAuth } from "../auth/testing";
import { createApp } from "../create-app";
import { type AdminRepository, createAdminService } from "./service";

const ORIGIN = "http://localhost";

function setup() {
  const auth = createTestAuth();
  const roles = new Map<string, string>();
  const items = new Map<string, string[]>();
  const expired: string[] = [];
  const repository: AdminRepository = {
    async setChampionRole(setId, champion, role) {
      if (role) {
        roles.set(`${setId}:${champion}`, role);
      } else {
        roles.delete(`${setId}:${champion}`);
      }
    },
    async setRoleItems(setId, role, list) {
      items.set(`${setId}:${role}`, list);
    },
    async setUserRole(userId, role) {
      const user = auth.memory.users.find((candidate) => candidate.id === userId);
      if (user) {
        user.role = role;
      }
      return user != null;
    },
  };
  const service = createAdminService({
    repository,
    catalog: async (setId) =>
      setId === 18
        ? {
            champions: new Set(["DA_18_Ahri"]),
            roles: new Set(["APCaster", "ADTank"]),
            items: new Set(["DA_Rabadon", "DA_Warmog"]),
          }
        : null,
  });
  const app = createApp({
    revalidateSecret: () => undefined,
    revalidate: () => {},
    databaseVersion: async () => null,
    auth: { service: auth.service, options: { secureCookies: false } },
    admin: { service, expireTag: (tag) => expired.push(tag) },
  });

  let cookie = "";
  const send = async (method: string, path: string, body?: unknown) => {
    const response = await app.request(`${ORIGIN}${path}`, {
      method,
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const access = response.headers.getSetCookie().find((line) => line.startsWith("tftvn_access="));
    if (access) {
      cookie = access.split(";")[0]!;
    }
    return response;
  };
  const login = async (admin: boolean) => {
    await send("POST", "/api/auth/register", {
      username: "quan_tri",
      email: "quan_tri@example.com",
      password: "mat-khau-an-toan",
    });
    auth.memory.users[0]!.role = admin ? "admin" : "user";
  };

  return { send, login, roles, items, expired, auth };
}

test.describe("admin routes", () => {
  test("rejects guests and regular users", async () => {
    const { send, login } = setup();
    const path = "/api/admin/sets/18/champions/DA_18_Ahri/role";
    expect((await send("PUT", path, { role: "APCaster" })).status).toBe(401);
    await login(false);
    expect((await send("PUT", path, { role: "APCaster" })).status).toBe(403);
  });

  test("assigns and clears a champion role", async () => {
    const { send, login, roles, expired } = setup();
    await login(true);
    const path = "/api/admin/sets/18/champions/DA_18_Ahri/role";
    const assigned = await send("PUT", path, { role: "APCaster" });
    expect(await assigned.json()).toEqual({ ok: true, setId: 18, role: "APCaster" });
    expect(roles.get("18:DA_18_Ahri")).toBe("APCaster");
    expect(expired).toEqual(["roles:18"]);

    await send("PUT", path, { role: null });
    expect(roles.has("18:DA_18_Ahri")).toBe(false);
  });

  test("validates set, champion and role", async () => {
    const { send, login } = setup();
    await login(true);
    const codes = async (path: string, body: unknown) => {
      const response = await send("PUT", path, body);
      return [response.status, ((await response.json()) as { code: string }).code];
    };
    expect(
      await codes("/api/admin/sets/99/champions/DA_18_Ahri/role", { role: "APCaster" }),
    ).toEqual([404, "setInvalid"]);
    expect(
      await codes("/api/admin/sets/abc/champions/DA_18_Ahri/role", { role: "APCaster" }),
    ).toEqual([404, "setInvalid"]);
    expect(await codes("/api/admin/sets/18/champions/Nope/role", { role: "APCaster" })).toEqual([
      404,
      "championInvalid",
    ]);
    expect(await codes("/api/admin/sets/18/champions/DA_18_Ahri/role", { role: "Wizard" })).toEqual(
      [400, "roleInvalid"],
    );
  });

  test("stores recommended items for a role", async () => {
    const { send, login, items } = setup();
    await login(true);
    const path = "/api/admin/sets/18/roles/APCaster/items";
    const saved = await send("PUT", path, { items: ["DA_Rabadon", "DA_Rabadon", "DA_Warmog"] });
    expect(await saved.json()).toEqual({ ok: true, setId: 18, items: ["DA_Rabadon", "DA_Warmog"] });
    expect(items.get("18:APCaster")).toEqual(["DA_Rabadon", "DA_Warmog"]);

    expect((await send("PUT", path, { items: ["Nope"] })).status).toBe(400);
    expect((await send("PUT", "/api/admin/sets/18/roles/Wizard/items", { items: [] })).status).toBe(
      404,
    );
  });

  test("promotes and demotes other users but never the current admin", async () => {
    const { send, login, auth } = setup();
    await login(true);
    await auth.service.register(
      { username: "nguoi_choi", email: "nguoi_choi@example.com", password: "mat-khau-an-toan" },
      "other",
    );
    const promote = await send("PUT", "/api/admin/users/2/role", { role: "admin" });
    expect(await promote.json()).toEqual({ ok: true, userId: 2, role: "admin" });
    expect(auth.memory.users[1]!.role).toBe("admin");

    await send("PUT", "/api/admin/users/2/role", { role: "user" });
    expect(auth.memory.users[1]!.role).toBe("user");

    const self = await send("PUT", "/api/admin/users/1/role", { role: "user" });
    expect([self.status, ((await self.json()) as { code: string }).code]).toEqual([
      400,
      "cannotChangeSelf",
    ]);
    expect((await send("PUT", "/api/admin/users/99/role", { role: "admin" })).status).toBe(404);
    expect((await send("PUT", "/api/admin/users/2/role", { role: "owner" })).status).toBe(400);
  });
});
