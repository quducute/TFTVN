import { type BrowserContext, type Page, expect, test } from "@playwright/test";
import { rateLimits, users } from "@tftvn/db";
import { createNodeDb } from "@tftvn/db/node";
import { eq } from "drizzle-orm";

const stamp = Date.now().toString(36);
const owner = {
  username: `e2e_comp_${stamp}`,
  email: `e2e_comp_${stamp}@example.com`,
  password: "mat-khau-e2e-123",
};
const compName = `Đội hình e2e ${stamp}`;
const renamed = `${compName} sửa`;

async function withDb<Result>(run: (db: ReturnType<typeof createNodeDb>["db"]) => Promise<Result>) {
  const { db, close } = createNodeDb(process.env.DATABASE_URL_DIRECT ?? "");
  try {
    return await run(db);
  } finally {
    await close();
  }
}

const boardCells = (page: Page) => page.getByRole("grid", { name: "Bàn cờ" }).getByRole("gridcell");
const filledCells = (page: Page) => boardCells(page).and(page.locator("[aria-label]"));

test.describe.configure({ mode: "serial" });

test.describe("comps", () => {
  let context: BrowserContext;
  let page: Page;
  let compUrl = "";
  let plannerCode = "";

  test.beforeAll(async ({ browser }) => {
    await withDb((db) => db.delete(rateLimits));
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("asks guests to log in before building", async ({ page: guest }) => {
    await guest.goto("/comps/new");
    await expect(guest.getByText("Đăng nhập để dùng tính năng này.")).toBeVisible();
  });

  test("builds and saves a comp", async () => {
    await page.goto("/register");
    await page.getByLabel("Tên đăng nhập", { exact: true }).fill(owner.username);
    await page.getByLabel("Email", { exact: true }).fill(owner.email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(owner.password);
    await page.getByRole("button", { name: "Đăng ký" }).click();
    await expect(page).toHaveURL(/\/profile$/);

    await page.goto("/comps/new");
    await expect(page.getByRole("heading", { name: "Tạo đội hình" })).toBeVisible();
    await page.getByRole("button", { name: "Lưu đội hình" }).click();
    await expect(page.getByText("Thêm ít nhất 1 tướng vào bàn cờ.").first()).toBeVisible();

    const pool = page
      .getByRole("region", { name: "Tướng" })
      .getByRole("listitem")
      .getByRole("button");
    await expect(async () => {
      await pool.nth(0).click();
      await expect(filledCells(page)).toHaveCount(1, { timeout: 1000 });
    }).toPass();
    await pool.nth(1).click();
    await pool.nth(2).click();
    await expect(filledCells(page)).toHaveCount(3);
    await expect(page.getByText("3/10 tướng")).toBeVisible();

    await page.getByRole("button", { name: "2 sao" }).click();
    const item = page.getByRole("tabpanel").getByRole("button").first();
    const itemName = (await item.getAttribute("aria-label")) ?? "";
    await item.click();
    await expect(page.getByRole("button", { name: `Gỡ ${itemName}` })).toBeVisible();
    await expect(
      filledCells(page).filter({ has: page.locator(`img[alt="${itemName}"]`) }),
    ).toHaveCount(1);

    await page.getByLabel("Tên đội hình").fill(compName);
    await page.getByLabel("Độ khó").selectOption("easy");
    await page.getByRole("button", { name: "Lưu đội hình" }).click();

    await expect(page).toHaveURL(/\/comps\/[0-9a-f-]{36}$/);
    compUrl = new URL(page.url()).pathname;
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(compName);
    await expect(page.getByText("Độ khó: Dễ")).toBeVisible();
    await expect(filledCells(page)).toHaveCount(3);
    await expect(boardCells(page).and(page.locator('[aria-label$=" 2*"]'))).toHaveCount(1);
    plannerCode = await page
      .getByRole("textbox", { name: "Mã team planner", exact: true })
      .inputValue();
    expect(plannerCode).toMatch(/^02(?:[0-9a-f]{3}){10}TFTSet\d+$/);
  });

  test("bookmarks the comp", async () => {
    await page.goto(compUrl);
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page.getByRole("button", { name: "Bỏ lưu" })).toBeVisible();
    await expect(page.getByText("1 lượt lưu")).toBeVisible();

    await page.goto("/comps/bookmarks");
    await expect(page.getByRole("heading", { name: compName })).toBeVisible();
  });

  test("edits the comp and shows the change right away", async () => {
    await page.goto(compUrl);
    await page.getByRole("link", { name: "Sửa" }).click();
    await expect(page.getByRole("heading", { name: "Sửa đội hình" })).toBeVisible();
    await page.getByLabel("Tên đội hình").fill(renamed);
    await page.getByRole("button", { name: "Lưu đội hình" }).click();
    await expect(page).toHaveURL(new RegExp(`${compUrl}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(renamed);

    await page.goto("/comps/latest");
    await expect(page.getByRole("heading", { name: renamed })).toBeVisible();
  });

  test("imports a team planner code", async () => {
    await page.goto("/comps/new");
    await page.getByLabel("Nhập mã team planner").fill(plannerCode);
    await expect(async () => {
      await page.getByRole("button", { name: "Nhập", exact: true }).click();
      await expect(page.getByText("Đã nhập 3 tướng.")).toBeVisible({ timeout: 1000 });
    }).toPass();
    await expect(filledCells(page)).toHaveCount(3);

    await page.getByLabel("Nhập mã team planner").fill("02000TFTSet18");
    await page.getByRole("button", { name: "Nhập", exact: true }).click();
    await expect(page.getByText("Mã team planner không hợp lệ.")).toBeVisible();
  });

  test("lets an admin set a meta tier that blocks deletion", async () => {
    await withDb((db) =>
      db.update(users).set({ role: "admin" }).where(eq(users.username, owner.username)),
    );
    await page.goto(compUrl);
    const tier = page.getByLabel("Meta tier");
    await expect(tier).toBeVisible();
    await tier.selectOption("S");
    await expect(page.getByText("Đã cập nhật meta.")).toBeVisible();

    await page.goto("/comps");
    await expect(
      page.getByRole("region", { name: "Hạng S" }).getByRole("heading", { name: renamed }),
    ).toBeVisible();

    await page.goto(compUrl);
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Xóa", exact: true }).click();
    await expect(
      page.getByText("Đội hình đang là meta nên không xóa được.", { exact: false }),
    ).toBeVisible();

    await page.getByLabel("Meta tier").selectOption("");
    await expect(page.getByText("Đã cập nhật meta.")).toBeVisible();
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Xóa", exact: true }).click();
    await expect(page).toHaveURL(/\/comps\/mine$/);
    await expect(page.getByText("Chưa có đội hình nào.")).toBeVisible();

    await page.goto(compUrl);
    await expect(page.getByText("This page could not be found")).toBeVisible();
  });
});
