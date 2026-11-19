import { expect, test } from "@playwright/test";
import { createTestAuth } from "../auth/testing";
import { createApp } from "../create-app";
import { createMemoryCompRepository } from "./memory-repository";
import { createCompService } from "./service";
import type { CompCatalog } from "./types";

const ORIGIN = "http://localhost";

const CATALOG: CompCatalog = {
  setId: 18,
  currentPatchId: "16.23",
  champions: new Set(["DA_18_Ahri", "DA_18_Leona"]),
  items: new Set(["DA_DragonsClaw", "DA_GargoyleStoneplate"]),
  augments: new Set(["Aug_One", "Aug_Two"]),
};

const VALID_COMP = {
  setId: 18,
  name: "Leona đỡ đòn",
  description: "Lên cấp 8 sớm",
  difficulty: "medium",
  playstyle: "fast8",
  board: [
    { championApiName: "DA_18_Leona", starLevel: 2, hex: 3, items: ["DA_GargoyleStoneplate"] },
    { championApiName: "DA_18_Ahri", starLevel: 1, hex: 24, items: [] },
    { championApiName: "DA_18_Ahri", starLevel: 1, hex: 25, items: [] },
  ],
  augments: ["Aug_One"],
  avatarChampionApiName: "DA_18_Leona",
};

function setup() {
  const auth = createTestAuth();
  const memory = createMemoryCompRepository(
    (id) => auth.memory.users.find((user) => user.id === id)?.username ?? "?",
  );
  const expired: string[] = [];
  let counter = 0;
  const service = createCompService({
    repository: memory.repository,
    catalog: async (setId) => (setId === CATALOG.setId ? CATALOG : null),
    newPublicId: () => {
      counter += 1;
      return `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
    },
    now: () => new Date("2026-11-19T10:00:00Z"),
  });
  const app = createApp({
    revalidateSecret: () => undefined,
    revalidate: () => {},
    databaseVersion: async () => null,
    auth: { service: auth.service, options: { secureCookies: false } },
    comps: { service, expireTag: (tag) => expired.push(tag) },
  });

  const client = () => {
    const jar: Record<string, string> = {};
    const send = async (method: string, path: string, body?: unknown) => {
      const cookie = Object.entries(jar)
        .map(([name, value]) => `${name}=${value}`)
        .join("; ");
      const response = await app.request(`${ORIGIN}${path}`, {
        method,
        headers: {
          origin: ORIGIN,
          "content-type": "application/json",
          ...(cookie ? { cookie } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      for (const line of response.headers.getSetCookie()) {
        const [name, value] = line.split(";")[0]!.split("=");
        jar[name!] = value!;
      }
      return response;
    };
    return {
      send,
      async register(username: string) {
        const response = await send("POST", "/api/auth/register", {
          username,
          email: `${username}@example.com`,
          password: "mat-khau-an-toan",
        });
        expect(response.status).toBe(201);
        return this;
      },
    };
  };

  const makeAdmin = (username: string) => {
    const user = auth.memory.users.find((candidate) => candidate.username === username)!;
    user.role = "admin";
  };

  return { client, makeAdmin, expired, memory };
}

async function createComp(send: ReturnType<ReturnType<typeof setup>["client"]>["send"]) {
  const response = await send("POST", "/api/comps", VALID_COMP);
  expect(response.status).toBe(201);
  const { comp } = (await response.json()) as { comp: { publicId: string } };
  return comp.publicId;
}

test.describe("comp routes", () => {
  test("requires login and a same-origin request to create", async () => {
    const { client } = setup();
    const guest = client();
    expect((await guest.send("POST", "/api/comps", VALID_COMP)).status).toBe(401);
  });

  test("creates a comp, derives champions and expires caches", async () => {
    const { client, expired } = setup();
    const owner = await client().register("chu_comp");
    const response = await owner.send("POST", "/api/comps", VALID_COMP);
    expect(response.status).toBe(201);
    const { comp } = (await response.json()) as { comp: Record<string, unknown> };
    expect(comp).toMatchObject({
      name: "Leona đỡ đòn",
      ownerUsername: "chu_comp",
      champions: ["DA_18_Leona", "DA_18_Ahri"],
      metaTier: null,
    });
    expect(comp).not.toHaveProperty("id");
    expect(expired).toEqual(["comps", `comp:${comp.publicId as string}`]);

    const fetched = await client().send("GET", `/api/comps/${comp.publicId as string}`);
    expect(fetched.status).toBe(200);
  });

  test("returns field codes for invalid content and unknown entities", async () => {
    const { client } = setup();
    const owner = await client().register("chu_comp");
    const cases: [unknown, Record<string, string>][] = [
      [{ ...VALID_COMP, name: "x" }, { name: "nameTooShort" }],
      [{ ...VALID_COMP, setId: 99 }, { setId: "setInvalid" }],
      [
        {
          ...VALID_COMP,
          board: [{ championApiName: "Nope", starLevel: 1, hex: 0, items: [] }],
          avatarChampionApiName: null,
        },
        { board: "unknownChampion" },
      ],
      [
        {
          ...VALID_COMP,
          board: [{ championApiName: "DA_18_Leona", starLevel: 1, hex: 0, items: ["Nope"] }],
          augments: ["Nope"],
        },
        { board: "unknownItem", augments: "unknownAugment" },
      ],
    ];
    for (const [body, fields] of cases) {
      const response = await owner.send("POST", "/api/comps", body);
      expect(response.status).toBe(400);
      expect(((await response.json()) as { fields: unknown }).fields).toEqual(fields);
    }
  });

  test("lets only the owner or an admin edit and delete", async () => {
    const { client, makeAdmin } = setup();
    const owner = await client().register("chu_comp");
    const other = await client().register("nguoi_khac");
    const admin = await client().register("quan_tri");
    makeAdmin("quan_tri");
    const id = await createComp(owner.send);
    const edited = { ...VALID_COMP, name: "Tên mới" };

    expect((await other.send("PUT", `/api/comps/${id}`, edited)).status).toBe(403);
    expect((await other.send("DELETE", `/api/comps/${id}`)).status).toBe(403);
    expect((await owner.send("PUT", `/api/comps/${id}`, edited)).status).toBe(200);
    const byAdmin = await admin.send("PUT", `/api/comps/${id}`, { ...edited, name: "Admin sửa" });
    expect(((await byAdmin.json()) as { comp: { name: string } }).comp.name).toBe("Admin sửa");

    expect((await owner.send("DELETE", `/api/comps/${id}`)).status).toBe(200);
    expect((await owner.send("GET", `/api/comps/${id}`)).status).toBe(404);
    expect((await owner.send("PUT", `/api/comps/${id}`, edited)).status).toBe(404);
  });

  test("treats malformed ids as not found", async () => {
    const { client } = setup();
    expect((await client().send("GET", "/api/comps/not-a-uuid")).status).toBe(404);
  });

  test("toggles bookmarks and counts them", async () => {
    const { client } = setup();
    const owner = await client().register("chu_comp");
    const fan = await client().register("nguoi_thich");
    const id = await createComp(owner.send);

    const anonymous = await client().send("GET", `/api/comps/${id}/bookmark`);
    expect(await anonymous.json()).toEqual({ ok: true, bookmarked: false, count: 0 });
    expect((await client().send("PUT", `/api/comps/${id}/bookmark`)).status).toBe(401);

    await fan.send("PUT", `/api/comps/${id}/bookmark`);
    await fan.send("PUT", `/api/comps/${id}/bookmark`);
    const after = await owner.send("PUT", `/api/comps/${id}/bookmark`);
    expect(await after.json()).toEqual({ ok: true, bookmarked: true, count: 2 });

    const removed = await fan.send("DELETE", `/api/comps/${id}/bookmark`);
    expect(await removed.json()).toEqual({ ok: true, bookmarked: false, count: 1 });
  });

  test("lets admins set meta tiers that block deletion", async () => {
    const { client, makeAdmin } = setup();
    const owner = await client().register("chu_comp");
    const admin = await client().register("quan_tri");
    makeAdmin("quan_tri");
    const id = await createComp(owner.send);

    expect((await owner.send("PUT", `/api/comps/${id}/meta`, { tier: "S" })).status).toBe(403);
    expect((await admin.send("PUT", `/api/comps/${id}/meta`, { tier: "Z" })).status).toBe(400);

    const meta = await admin.send("PUT", `/api/comps/${id}/meta`, { tier: "S" });
    expect(((await meta.json()) as { comp: unknown }).comp).toMatchObject({
      metaTier: "S",
      metaPatchId: "16.23",
      metaUpdatedAt: "2026-11-19T10:00:00.000Z",
    });

    const blocked = await owner.send("DELETE", `/api/comps/${id}`);
    expect(blocked.status).toBe(409);
    expect(((await blocked.json()) as { code: string }).code).toBe("compIsMeta");

    const cleared = await admin.send("PUT", `/api/comps/${id}/meta`, { tier: null });
    expect(((await cleared.json()) as { comp: unknown }).comp).toMatchObject({
      metaTier: null,
      metaPatchId: null,
    });
    expect((await owner.send("DELETE", `/api/comps/${id}`)).status).toBe(200);
  });

  test("lists by owner, bookmark, meta and champion", async () => {
    const { client, memory } = setup();
    const owner = await client().register("chu_comp");
    const id = await createComp(owner.send);
    await owner.send("POST", "/api/comps", {
      ...VALID_COMP,
      board: [{ championApiName: "DA_18_Ahri", starLevel: 3, hex: 0, items: [] }],
      avatarChampionApiName: null,
    });
    await owner.send("PUT", `/api/comps/${id}/bookmark`);
    const list = (filter: object) =>
      memory.repository.list({ limit: 10, offset: 0, ...filter }).then((page) => page.total);

    expect(await list({ ownerId: 1 })).toBe(2);
    expect(await list({ championApiName: "DA_18_Leona" })).toBe(1);
    expect(await list({ bookmarkedBy: 1 })).toBe(1);
    expect(await list({ metaOnly: true })).toBe(0);
    expect(await list({ setId: 17 })).toBe(0);
  });
});
