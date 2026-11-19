import { type Browser, type BrowserContext, type Page, expect, test } from "@playwright/test";
import { rateLimits, users } from "@tftvn/db";
import { createNodeDb } from "@tftvn/db/node";
import { eq } from "drizzle-orm";

const stamp = Date.now().toString(36);
const author = `e2e_tacgia_${stamp}`;
const admin = `e2e_admin_${stamp}`;
const title = `Bài e2e ${stamp}`;

async function withDb<Result>(run: (db: ReturnType<typeof createNodeDb>["db"]) => Promise<Result>) {
  const { db, close } = createNodeDb(process.env.DATABASE_URL_DIRECT ?? "");
  try {
    return await run(db);
  } finally {
    await close();
  }
}

async function register(browser: Browser, username: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/register");
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill(username);
  await page.getByLabel("Email", { exact: true }).fill(`${username}@example.com`);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("mat-khau-e2e-123");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  return { context, page };
}

test.describe.configure({ mode: "serial" });

test.describe("articles and admin", () => {
  let authorContext: BrowserContext;
  let adminContext: BrowserContext;
  let authorPage: Page;
  let adminPage: Page;
  let articleUrl = "";

  test.beforeAll(async ({ browser }) => {
    await withDb((db) => db.delete(rateLimits));
    ({ context: authorContext, page: authorPage } = await register(browser, author));
    ({ context: adminContext, page: adminPage } = await register(browser, admin));
    await withDb((db) => db.update(users).set({ role: "admin" }).where(eq(users.username, admin)));
  });

  test.afterAll(async () => {
    await authorContext.close();
    await adminContext.close();
  });

  test("writes an article that waits for review", async ({ page: guest }) => {
    const page = authorPage;
    await page.goto("/articles/new");
    await expect(
      page.getByText("Bài mới và bài sửa lại sẽ chờ admin duyệt").filter({ visible: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Gửi bài" }).click();
    await expect(page.getByText("Tiêu đề cần ít nhất 5 ký tự.").first()).toBeVisible();

    await page.getByLabel("Tiêu đề", { exact: true }).fill(title);
    await page.getByLabel("Chuyên mục").selectOption("guide");
    await page.getByLabel("Thẻ (cách nhau bằng dấu phẩy, tối đa 5)").fill("KiemThu, leo-rank");
    const body = page.getByRole("textbox", { name: "Nội dung" });
    await expect(async () => {
      await body.click();
      await page.keyboard.type("Mo dau bai viet");
      await expect(body).toContainText("Mo dau", { timeout: 1000 });
    }).toPass();
    await page.getByRole("button", { name: "Tiêu đề lớn" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Noi dung dam du dai de qua kiem tra");
    await expect(body).toContainText("Noi dung dam du dai de qua kiem tra");
    await page.keyboard.press("Shift+Home");
    await page.getByRole("button", { name: "Đậm" }).click();
    await expect(body.locator("strong")).toHaveText("Noi dung dam du dai de qua kiem tra");
    await page.getByRole("button", { name: "Gửi bài" }).click();

    await expect(page).toHaveURL(/\/articles\/[0-9a-f-]{36}$/);
    articleUrl = new URL(page.url()).pathname;
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(
      page.getByText("Bài đang chờ admin duyệt").filter({ visible: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Mo dau bai viet" })).toBeVisible();
    await expect(page.locator(".article-body strong")).toHaveText(
      "Noi dung dam du dai de qua kiem tra",
    );
    await expect(page.getByRole("link", { name: "#kiemthu" })).toBeVisible();

    await guest.goto(articleUrl);
    await expect(guest.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
    await guest.goto("/articles");
    await expect(guest.getByRole("heading", { name: title })).toHaveCount(0);

    await page.goto("/articles/mine");
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("Đang chờ duyệt").filter({ visible: true })).toBeVisible();
  });

  test("lets an admin reject with a reason", async () => {
    const page = adminPage;
    await page.goto("/admin");
    await expect(page.getByRole("link", { name: "Quản trị" })).toBeVisible();
    const card = page.getByRole("listitem").filter({ hasText: title });
    await expect(async () => {
      await card.getByRole("button", { name: "Từ chối" }).click();
      await expect(page.getByText("Hãy ghi lý do từ chối.")).toBeVisible({ timeout: 1000 });
    }).toPass();
    await card.getByLabel("Lý do từ chối").fill("Cần thêm ví dụ");
    await card.getByRole("button", { name: "Từ chối" }).click();
    await expect(page.getByRole("heading", { name: title })).toHaveCount(0);

    await authorPage.goto(articleUrl);
    await expect(
      authorPage.getByText("Admin đã từ chối bài này: Cần thêm ví dụ").filter({ visible: true }),
    ).toBeVisible();
  });

  test("sends an edited article back to review, then approves it", async ({ page: guest }) => {
    await authorPage.goto(articleUrl);
    await authorPage.getByRole("link", { name: "Sửa" }).click();
    await expect(authorPage.getByRole("heading", { name: "Sửa bài viết" })).toBeVisible();
    await authorPage.getByLabel("Tiêu đề", { exact: true }).fill(`${title} bản 2`);
    await authorPage.getByRole("button", { name: "Gửi bài" }).click();
    await expect(authorPage.getByRole("heading", { level: 1 })).toHaveText(`${title} bản 2`);
    await expect(
      authorPage.getByText("Bài đang chờ admin duyệt").filter({ visible: true }),
    ).toBeVisible();

    await adminPage.goto("/admin");
    const card = adminPage.getByRole("listitem").filter({ hasText: `${title} bản 2` });
    await expect(async () => {
      await card.getByRole("button", { name: "Duyệt" }).click();
      await expect(adminPage.getByRole("heading", { name: `${title} bản 2` })).toHaveCount(0, {
        timeout: 1000,
      });
    }).toPass();

    await guest.goto("/articles?category=guide");
    await guest.getByRole("link", { name: `${title} bản 2` }).click();
    await expect(guest).toHaveURL(new RegExp(`${articleUrl}$`));
    await expect(guest.getByText("Đăng nhập để bày tỏ cảm xúc.")).toBeVisible();
  });

  test("counts reactions", async () => {
    await authorPage.goto(articleUrl);
    const love = authorPage.getByRole("button", { name: /Yêu thích/ });
    await expect(love).toBeEnabled();
    await love.click();
    await expect(love).toHaveAttribute("aria-pressed", "true");
    await expect(love).toContainText("1");
    await authorPage.getByRole("button", { name: /^Hay/ }).click();
    await expect(love).toContainText("0");
    await expect(authorPage.getByRole("button", { name: /^Hay/ })).toContainText("1");
  });

  test("lets an admin assign a champion role", async () => {
    const page = adminPage;
    await page.goto("/admin/roles");
    const select = page.getByRole("combobox", { name: /^Admin gán: / }).first();
    const label = (await select.getAttribute("aria-label")) ?? "";
    await expect(async () => {
      await select.selectOption("APTank");
      await expect(page.getByText("Đã lưu.")).toBeVisible({ timeout: 1000 });
    }).toPass();
    await page.reload();
    await expect(page.getByRole("combobox", { name: label })).toHaveValue("APTank");

    await page.getByRole("combobox", { name: label }).selectOption("");
    await expect(page.getByText("Đã lưu.")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("combobox", { name: label })).toHaveValue("");
  });

  test("lets an admin promote and demote other users only", async () => {
    const page = adminPage;
    await page.goto(`/admin/users?q=${author}`);
    const authorRole = page.getByRole("combobox", { name: `Quyền của ${author}` });
    const changeRole = async (role: string) => {
      const saved = page.waitForResponse(
        (response) =>
          response.url().includes("/api/admin/users/") && response.request().method() === "PUT",
      );
      await authorRole.selectOption(role);
      expect((await saved).status()).toBe(200);
      await page.reload();
      await expect(authorRole).toHaveValue(role);
    };
    await expect(authorRole).toBeEnabled();
    await changeRole("admin");
    await changeRole("user");

    await page.goto(`/admin/users?q=${admin}`);
    await expect(page.getByRole("combobox", { name: `Quyền của ${admin}` })).toBeDisabled();
  });

  test("keeps regular users out of the admin pages", async () => {
    await authorPage.goto("/admin");
    await expect(
      authorPage.getByText("Trang này chỉ dành cho admin.").filter({ visible: true }),
    ).toBeVisible();
    const response = await authorPage.request.put("/api/admin/sets/18/roles/APTank/items", {
      data: { items: [] },
      headers: { origin: new URL(authorPage.url()).origin },
    });
    expect(response.status()).toBe(403);
  });
});
