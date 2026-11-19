import { createHash, randomBytes } from "node:crypto";
import { type Page, expect, test } from "@playwright/test";
import { userTokens, users } from "@tftvn/db";
import { createNodeDb } from "@tftvn/db/node";
import { eq } from "drizzle-orm";

const stamp = Date.now().toString(36);
const account = {
  username: `e2e_${stamp}`,
  email: `e2e_${stamp}@example.com`,
  password: "mat-khau-e2e-123",
};

async function login(page: Page, identifier = account.username, password = account.password) {
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập hoặc email", { exact: true }).fill(identifier);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

async function loginAndWait(page: Page) {
  await login(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("banner").getByRole("link", { name: account.username }),
  ).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test.describe("account", () => {
  test("register validates input then creates the account", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: "Đăng ký" }).click();
    await expect(page.getByText("Vui lòng nhập trường này.")).toHaveCount(3);

    await page.getByLabel("Tên đăng nhập", { exact: true }).fill("ab");
    await page.getByRole("button", { name: "Đăng ký" }).click();
    await expect(page.getByText("Tên đăng nhập cần ít nhất 3 ký tự.")).toBeVisible();

    await page.getByLabel("Tên đăng nhập", { exact: true }).fill(account.username);
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Đăng ký" }).click();

    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole("heading", { name: "Tài khoản của bạn" })).toBeVisible();
    await expect(
      page.getByRole("banner").getByRole("link", { name: account.username }),
    ).toBeVisible();
  });

  test("refuses a duplicate username", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Tên đăng nhập", { exact: true }).fill(account.username.toUpperCase());
    await page.getByLabel("Email", { exact: true }).fill(`other_${account.email}`);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Đăng ký" }).click();
    await expect(page.getByText("Tên đăng nhập đã có người dùng.")).toBeVisible();
  });

  test("shows one generic error for wrong credentials", async ({ page }) => {
    await login(page, account.username, "sai-mat-khau-123");
    await expect(page.getByText("Sai tên đăng nhập hoặc mật khẩu.")).toBeVisible();
  });

  test("logs in with the email, then logs out", async ({ page }) => {
    await login(page, account.email);
    await expect(page).toHaveURL(/\/$/);
    const userLink = page.getByRole("banner").getByRole("link", { name: account.username });
    await expect(userLink).toBeVisible();

    await userLink.click();
    await page.getByRole("button", { name: "Đăng xuất" }).click();
    await expect(page.getByRole("banner").getByRole("link", { name: "Đăng nhập" })).toBeVisible();
  });

  test("keeps the session after the access token cookie is gone", async ({ page, context }) => {
    await loginAndWait(page);
    const cookies = await context.cookies();
    await context.clearCookies();
    await context.addCookies(cookies.filter((cookie) => cookie.name !== "tftvn_access"));

    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Tài khoản của bạn" })).toBeVisible();
  });

  test("updates the profile, password and Riot ID", async ({ page }) => {
    await loginAndWait(page);
    await page.goto("/profile");

    const newEmail = `new_${account.email}`;
    await page.getByLabel("Email", { exact: true }).fill(newEmail);
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(page.getByText("Đã lưu thay đổi.")).toBeVisible();
    account.email = newEmail;

    await page.getByLabel("Mật khẩu hiện tại").fill("sai-mat-khau-123");
    await page.getByLabel("Mật khẩu mới").fill("mat-khau-moi-456");
    await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
    await expect(page.getByText("Mật khẩu hiện tại không đúng.")).toBeVisible();

    await page.getByLabel("Mật khẩu hiện tại").fill(account.password);
    await page.getByLabel("Mật khẩu mới").fill("mat-khau-moi-456");
    await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
    await expect(page.getByText(/Đã đổi mật khẩu/)).toBeVisible();
    account.password = "mat-khau-moi-456";

    await page.getByLabel("Tên trong game").fill("Quý Đức");
    await page.getByLabel("Tag", { exact: true }).fill("VN2");
    await page.getByRole("button", { name: "Liên kết" }).click();

    let riotId = "Quý Đức#VN2";
    if (process.env.RIOT_API_KEY) {
      await expect(page.getByText("Không tìm thấy tài khoản Riot này.")).toBeVisible();
      await page.goto("/leaderboard");
      riotId = (await page.getByRole("table").getByRole("link").first().textContent()) ?? "";
      const separator = riotId.lastIndexOf("#");
      await page.goto("/profile");
      await page.getByLabel("Tên trong game").fill(riotId.slice(0, separator));
      await page.getByLabel("Tag", { exact: true }).fill(riotId.slice(separator + 1));
      await page.getByRole("button", { name: "Liên kết" }).click();
    }
    await expect(page.getByText(`Đã liên kết ${riotId}`)).toBeVisible();
    await expect(page.getByRole("link", { name: "Xem trang người chơi" })).toHaveAttribute(
      "href",
      /^\/players\/[^/]+\/[^/]+$/,
    );

    await page.getByRole("button", { name: "Hủy liên kết" }).click();
    await expect(page.getByText("Chưa liên kết Riot ID.")).toBeVisible();
  });

  test("resets the password through the emailed link", async ({ page }) => {
    const token = randomBytes(32).toString("base64url");
    const { db, close } = createNodeDb(process.env.DATABASE_URL_DIRECT ?? "");
    try {
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, account.username));
      await db.insert(userTokens).values({
        userId: user!.id,
        kind: "password_reset",
        tokenHash: createHash("sha256").update(token).digest(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
    } finally {
      await close();
    }

    await page.goto(`/reset-password?token=${token}`);
    await page.getByLabel("Mật khẩu mới", { exact: true }).fill("mat-khau-reset-789");
    await page.getByRole("button", { name: "Lưu mật khẩu mới" }).click();
    await expect(page.getByText("Đã đổi mật khẩu. Hãy đăng nhập lại.")).toBeVisible();
    account.password = "mat-khau-reset-789";

    await page.goto(`/reset-password?token=${token}`);
    await page.getByLabel("Mật khẩu mới", { exact: true }).fill("mat-khau-khac-000");
    await page.getByRole("button", { name: "Lưu mật khẩu mới" }).click();
    await expect(
      page.getByText("Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn."),
    ).toBeVisible();
  });

  test("logs in with the new password", async ({ page }) => {
    await loginAndWait(page);
  });

  test("forgot password always confirms without revealing accounts", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email", { exact: true }).fill("khong-ton-tai@example.com");
    await page.getByRole("button", { name: "Gửi link" }).click();
    await expect(page.getByText(/Nếu email này đã đăng ký/)).toBeVisible();
  });

  test("reset page without a token explains the problem", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByText("Link không hợp lệ hoặc thiếu mã đặt lại.")).toBeVisible();
  });

  test("guests are sent from the profile to the login page", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("the API rejects writes from another origin", async ({ request }) => {
    const response = await request.post("/api/auth/login", {
      headers: { origin: "https://evil.example" },
      data: { identifier: account.username, password: account.password },
    });
    expect(response.status()).toBe(403);
  });
});
