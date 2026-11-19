import { expect, test } from "@playwright/test";

test.describe("stats", () => {
  test("redirects to challenger champions and switches tabs", async ({ page }) => {
    await page.goto("/stats");
    await expect(page).toHaveURL(/\/stats\/challenger\/champions$/);
    await expect(page.getByRole("link", { name: "Thách Đấu" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("table")).toBeVisible();

    await expect(async () => {
      await page.getByRole("link", { name: "Tộc / Hệ" }).click();
      await expect(page).toHaveURL(/\/stats\/challenger\/traits$/, { timeout: 1000 });
    }).toPass();
    await expect(page.getByText(/Mốc \d/).first()).toBeVisible();

    await page.getByRole("link", { name: "Cao Thủ", exact: true }).click();
    await expect(page).toHaveURL(/\/stats\/master\/traits$/);
  });

  test("sorts by average placement", async ({ page }) => {
    await page.goto("/stats/challenger/items");
    const header = page.getByRole("columnheader", { name: /Hạng TB/ });
    await header.getByRole("button").click();
    await expect(header).toHaveAttribute("aria-sort", "ascending");

    const values = await page.getByRole("row").locator("td:nth-child(4)").allTextContents();
    const numbers = values.map(Number);
    expect(numbers.length).toBeGreaterThan(1);
    expect(numbers).toEqual([...numbers].sort((left, right) => left - right));

    await header.getByRole("button").click();
    await expect(header).toHaveAttribute("aria-sort", "descending");
  });

  test("renders in English and keeps the path", async ({ page }) => {
    await page.goto("/stats/grandmaster/champions");
    await expect(async () => {
      await page.getByRole("button", { name: "EN" }).click();
      await expect(page).toHaveURL(/\/en\/stats\/grandmaster\/champions$/, { timeout: 1000 });
    }).toPass();
    await expect(page.getByRole("columnheader", { name: /Avg place/ })).toBeVisible();
  });

  test("shows not found for an unknown tier", async ({ page }) => {
    await page.goto("/stats/iron/champions");
    await expect(page.getByText("This page could not be found")).toBeVisible();
  });
});

test.describe("player search", () => {
  test("links every header entry", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("banner").getByRole("navigation");
    for (const name of ["Thư viện", "Tra cứu", "Bảng xếp hạng", "Thống kê"]) {
      await expect(nav.getByRole("link", { name })).toBeVisible();
    }
  });

  test("rejects an id without a tag", async ({ page }) => {
    await page.goto("/players");
    await page.getByRole("searchbox").fill("NoTagHere");
    await page.getByRole("button", { name: "Tìm" }).click();
    await expect(page.getByText("Hãy nhập Riot ID dạng Tên#Tag.")).toBeVisible();
    await expect(page).toHaveURL(/\/players$/);
  });
});

test.describe("riot api", () => {
  test.skip(!process.env.RIOT_API_KEY, "RIOT_API_KEY is not set");

  test("opens a challenger from the leaderboard", async ({ page }) => {
    await page.goto("/leaderboard");
    const rows = page.getByRole("table").getByRole("row");
    await expect(rows).toHaveCount(21);
    await expect(page.getByText(/Trang 1\/\d+/)).toBeVisible();

    const player = page.getByRole("table").getByRole("link").first();
    const riotId = (await player.textContent()) ?? "";
    await player.click();
    await expect(page).toHaveURL(/\/players\/[^/]+\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(riotId);
    await expect(page.getByRole("heading", { name: "Xếp hạng" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Trận gần đây" })).toBeVisible();

    const firstMatch = page
      .getByRole("listitem")
      .filter({ has: page.locator("details") })
      .first();
    await firstMatch.getByText("Xem cả 8 người chơi").click();
    await expect(firstMatch.locator("details ol > li")).toHaveCount(8);
    await expect(firstMatch.locator('details a[aria-current="page"]')).toHaveCount(1);
  });

  test("goes to the next leaderboard page", async ({ page }) => {
    await page.goto("/leaderboard");
    await page.getByRole("link", { name: "Trang sau" }).click();
    await expect(page).toHaveURL(/\/leaderboard\?page=2$/);
    await expect(page.getByText(/Trang 2\/\d+/)).toBeVisible();
    await expect(page.getByRole("cell", { name: "21", exact: true })).toBeVisible();

    await expect(async () => {
      await page.getByRole("button", { name: "EN" }).click();
      await expect(page).toHaveURL(/\/en\/leaderboard\?page=2$/, { timeout: 1000 });
    }).toPass();
  });

  test("reports a missing player and keeps the search box filled", async ({ page }) => {
    await page.goto("/players");
    await page.getByRole("searchbox").fill("Khong Ton Tai Zz#ZZ9");
    await page.getByRole("button", { name: "Tìm" }).click();
    await expect(page).toHaveURL(/\/players\/Khong%20Ton%20Tai%20Zz\/ZZ9$/);
    await expect(
      page.getByRole("alert").filter({ hasText: "Không tìm thấy người chơi này trên máy chủ VN." }),
    ).toBeVisible();
    await expect(page.getByRole("searchbox")).toHaveValue("Khong Ton Tai Zz#ZZ9");
  });
});
