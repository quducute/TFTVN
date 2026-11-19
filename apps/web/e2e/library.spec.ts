import { expect, test } from "@playwright/test";

test.describe("home", () => {
  test("renders in Vietnamese by default", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trợ thủ Đấu Trường Chân Lý");
    await expect(page.getByText(/Hoạt động - PostgreSQL/)).toBeVisible();
  });

  test("stays Vietnamese for an English browser", async ({ browser }) => {
    const context = await browser.newContext({ locale: "en-US" });
    const page = await context.newPage();
    await page.goto("/library");
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    await context.close();
  });

  test("renders in English under /en", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Teamfight Tactics Assistant");
  });
});

test.describe("library", () => {
  test("lists sets and opens the current one", async ({ page }) => {
    await page.goto("/library");
    const current = page.getByRole("link", { name: /Set \d+.*Hiện tại/ });
    await expect(current).toBeVisible();
    await current.click();
    await expect(page).toHaveURL(/\/library\/\d+$/);
    await expect(page.getByRole("navigation").getByRole("link", { name: "Tướng" })).toBeVisible();
  });

  test("opens a champion from the champion list", async ({ page }) => {
    await page.goto("/library");
    await page.getByRole("link", { name: /Hiện tại/ }).click();
    await page.getByRole("navigation").getByRole("link", { name: "Tướng" }).click();
    await expect(page).toHaveURL(/\/library\/\d+\/champions$/);

    const firstChampion = page.locator("main ul a").first();
    const name = (await firstChampion.locator("span.font-medium").textContent())?.trim() ?? "";
    await firstChampion.click();

    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    await expect(page.getByText("Chỉ số cơ bản")).toBeVisible();
    await expect(page.getByText("Kỹ năng", { exact: true })).toBeVisible();
  });

  test("shows grouped items and augments", async ({ page }) => {
    await page.goto("/library");
    await page.getByRole("link", { name: /Hiện tại/ }).click();

    await page.getByRole("navigation").getByRole("link", { name: "Trang bị" }).click();
    await expect(page.getByRole("heading", { name: /Trang bị ghép/ })).toBeVisible();

    await page.getByRole("navigation").getByRole("link", { name: "Lõi nâng cấp" }).click();
    await expect(page.getByRole("heading", { name: /Lăng kính/ })).toBeVisible();
  });

  test("switches language and keeps the page", async ({ page }) => {
    await page.goto("/library");
    await page.getByRole("link", { name: /Hiện tại/ }).click();
    await page.getByRole("navigation").getByRole("link", { name: "Tộc / Hệ" }).click();
    await expect(page).toHaveURL(/\/library\/\d+\/traits$/);
    await page.getByRole("button", { name: "EN" }).click();

    await expect(page).toHaveURL(/\/en\/library\/\d+\/traits$/);
    await expect(page.getByRole("navigation").getByRole("link", { name: "Traits" })).toBeVisible();
  });

  test("shows not found for an unknown set", async ({ page }) => {
    await page.goto("/library/9999");
    await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  });
});
