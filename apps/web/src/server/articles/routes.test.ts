import { expect, test } from "@playwright/test";
import { createTestAuth } from "../auth/testing";
import { createApp } from "../create-app";
import { createMemoryArticleRepository } from "./memory-repository";
import { createArticleService } from "./service";

const ORIGIN = "http://localhost";
const COMP_ID = "00000000-0000-4000-8000-0000000000c1";

const VALID_ARTICLE = {
  title: "Hướng dẫn leo rank Set 18",
  category: "guide",
  setId: 18,
  tags: ["Meta", "leo-rank"],
  body: "<h1>Mở đầu</h1><p>Đây là bài hướng dẫn chi tiết.<script>alert(1)</script></p>",
  compIds: [COMP_ID],
};

function setup() {
  const auth = createTestAuth();
  const memory = createMemoryArticleRepository({
    username: (id) => auth.memory.users.find((user) => user.id === id)?.username ?? "?",
    compPublicId: (id) => (id === 7 ? COMP_ID : null),
  });
  const expired: string[] = [];
  let counter = 0;
  const service = createArticleService({
    repository: memory.repository,
    setExists: async (setId) => setId === 18,
    resolveComps: async (ids) => new Map(ids.filter((id) => id === COMP_ID).map((id) => [id, 7])),
    newPublicId: () => {
      counter += 1;
      return `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
    },
    now: () => new Date("2026-11-19T12:00:00Z"),
  });
  const app = createApp({
    revalidateSecret: () => undefined,
    revalidate: () => {},
    databaseVersion: async () => null,
    auth: { service: auth.service, options: { secureCookies: false } },
    articles: { service, expireTag: (tag) => expired.push(tag) },
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
    auth.memory.users.find((user) => user.username === username)!.role = "admin";
  };

  return { client, makeAdmin, expired };
}

type ArticleJson = { article: Record<string, unknown> & { publicId: string } };

async function createArticle(send: ReturnType<ReturnType<typeof setup>["client"]>["send"]) {
  const response = await send("POST", "/api/articles", VALID_ARTICLE);
  expect(response.status).toBe(201);
  return ((await response.json()) as ArticleJson).article;
}

test.describe("article routes", () => {
  test("sanitizes the body, queues the article and hides it from others", async () => {
    const { client, expired } = setup();
    const author = await client().register("tac_gia");
    const article = await createArticle(author.send);
    expect(article).toMatchObject({
      status: "queued",
      authorUsername: "tac_gia",
      tags: ["meta", "leo-rank"],
      body: "<h2>Mở đầu</h2><p>Đây là bài hướng dẫn chi tiết.</p>",
      compIds: [COMP_ID],
    });
    expect(expired).toEqual(["articles", `article:${article.publicId}`]);

    expect((await author.send("GET", `/api/articles/${article.publicId}`)).status).toBe(200);
    expect((await client().send("GET", `/api/articles/${article.publicId}`)).status).toBe(404);
    const other = await client().register("nguoi_khac");
    expect((await other.send("GET", `/api/articles/${article.publicId}`)).status).toBe(404);
    expect(
      (await other.send("PUT", `/api/articles/${article.publicId}`, VALID_ARTICLE)).status,
    ).toBe(404);
  });

  test("rejects invalid content with field codes", async () => {
    const { client } = setup();
    const author = await client().register("tac_gia");
    const cases: [unknown, Record<string, string>][] = [
      [{ ...VALID_ARTICLE, title: "abc" }, { title: "titleTooShort" }],
      [
        { ...VALID_ARTICLE, body: "<p>ngắn</p><script>rất dài nhưng bị xóa hết</script>" },
        { body: "bodyTooShort" },
      ],
      [{ ...VALID_ARTICLE, setId: 99 }, { setId: "setInvalid" }],
      [
        { ...VALID_ARTICLE, compIds: ["00000000-0000-4000-8000-000000000999"] },
        { compIds: "compInvalid" },
      ],
    ];
    for (const [body, fields] of cases) {
      const response = await author.send("POST", "/api/articles", body);
      expect(response.status).toBe(400);
      expect(((await response.json()) as { fields: unknown }).fields).toEqual(fields);
    }
    expect((await client().send("POST", "/api/articles", VALID_ARTICLE)).status).toBe(401);
  });

  test("lets admins review, and author edits send the article back to the queue", async () => {
    const { client, makeAdmin } = setup();
    const author = await client().register("tac_gia");
    const admin = await client().register("quan_tri");
    makeAdmin("quan_tri");
    const { publicId } = await createArticle(author.send);

    expect(
      (await author.send("PUT", `/api/articles/${publicId}/review`, { status: "approved" })).status,
    ).toBe(403);
    const missingNote = await admin.send("PUT", `/api/articles/${publicId}/review`, {
      status: "rejected",
    });
    expect(((await missingNote.json()) as { fields: unknown }).fields).toEqual({
      note: "noteRequired",
    });

    const rejected = await admin.send("PUT", `/api/articles/${publicId}/review`, {
      status: "rejected",
      note: "Thiếu ví dụ",
    });
    expect(((await rejected.json()) as ArticleJson).article).toMatchObject({
      status: "rejected",
      reviewNote: "Thiếu ví dụ",
      reviewerUsername: "quan_tri",
    });

    const approved = await admin.send("PUT", `/api/articles/${publicId}/review`, {
      status: "approved",
    });
    expect(((await approved.json()) as ArticleJson).article.status).toBe("approved");
    expect((await client().send("GET", `/api/articles/${publicId}`)).status).toBe(200);

    const byAdmin = await admin.send("PUT", `/api/articles/${publicId}`, {
      ...VALID_ARTICLE,
      title: "Admin sửa tiêu đề",
    });
    expect(((await byAdmin.json()) as ArticleJson).article.status).toBe("approved");

    const byAuthor = await author.send("PUT", `/api/articles/${publicId}`, {
      ...VALID_ARTICLE,
      title: "Tác giả sửa lại",
    });
    expect(((await byAuthor.json()) as ArticleJson).article).toMatchObject({
      status: "queued",
      reviewNote: null,
      reviewerUsername: null,
    });
  });

  test("auto-approves articles written by admins", async () => {
    const { client, makeAdmin } = setup();
    const admin = await client().register("quan_tri");
    makeAdmin("quan_tri");
    const article = await createArticle(admin.send);
    expect(article).toMatchObject({ status: "approved", reviewerUsername: "quan_tri" });
  });

  test("counts one reaction per user on approved articles", async () => {
    const { client, makeAdmin } = setup();
    const author = await client().register("tac_gia");
    const admin = await client().register("quan_tri");
    const fan = await client().register("nguoi_doc");
    makeAdmin("quan_tri");
    const { publicId } = await createArticle(author.send);

    const early = await fan.send("PUT", `/api/articles/${publicId}/reaction`, { kind: "heart" });
    expect(((await early.json()) as { code: string }).code).toBe("notApproved");
    await admin.send("PUT", `/api/articles/${publicId}/review`, { status: "approved" });

    await fan.send("PUT", `/api/articles/${publicId}/reaction`, { kind: "heart" });
    await fan.send("PUT", `/api/articles/${publicId}/reaction`, { kind: "like" });
    await author.send("PUT", `/api/articles/${publicId}/reaction`, { kind: "like" });
    const mine = await fan.send("GET", `/api/articles/${publicId}/reactions`);
    expect(await mine.json()).toEqual({
      ok: true,
      counts: { heart: 0, like: 2, dislike: 0 },
      mine: "like",
    });

    await fan.send("PUT", `/api/articles/${publicId}/reaction`, { kind: null });
    const guest = await client().send("GET", `/api/articles/${publicId}/reactions`);
    expect(await guest.json()).toEqual({
      ok: true,
      counts: { heart: 0, like: 1, dislike: 0 },
      mine: null,
    });
    const invalid = await fan.send("PUT", `/api/articles/${publicId}/reaction`, { kind: "angry" });
    expect(invalid.status).toBe(400);
  });

  test("deletes softly for the author only", async () => {
    const { client } = setup();
    const author = await client().register("tac_gia");
    const other = await client().register("nguoi_khac");
    const { publicId } = await createArticle(author.send);
    expect((await other.send("DELETE", `/api/articles/${publicId}`)).status).toBe(404);
    expect((await author.send("DELETE", `/api/articles/${publicId}`)).status).toBe(200);
    expect((await author.send("GET", `/api/articles/${publicId}`)).status).toBe(404);
  });
});
