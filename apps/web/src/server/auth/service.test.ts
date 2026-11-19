import { expect, test } from "@playwright/test";
import { RATE_LIMITS } from "./service";
import { VALID_ACCOUNT, createTestAuth } from "./testing";

const CLIENT = "203.0.113.7";

async function registered() {
  const auth = createTestAuth();
  const result = await auth.service.register(VALID_ACCOUNT, CLIENT);
  if (!result.ok) {
    throw new Error(result.code);
  }
  return { ...auth, session: result.value };
}

test.describe("register", () => {
  test("creates a user and a session without storing the plain password", async () => {
    const { memory, session } = await registered();
    expect(session.user).toMatchObject({ username: "qudu_18", role: "user", riot: null });
    expect(memory.users[0]!.passwordHash).not.toBe(VALID_ACCOUNT.password);
    expect(memory.tokens.filter((token) => token.kind === "refresh")).toHaveLength(1);
  });

  test("rejects duplicate usernames and emails regardless of case", async () => {
    const { service } = await registered();
    const sameName = await service.register(
      { ...VALID_ACCOUNT, username: "QUDU_18", email: "other@example.com" },
      CLIENT,
    );
    expect(sameName).toMatchObject({ ok: false, status: 409, code: "usernameTaken" });
    const sameEmail = await service.register(
      { ...VALID_ACCOUNT, username: "someone", email: "QUDU@example.com" },
      CLIENT,
    );
    expect(sameEmail).toMatchObject({ ok: false, status: 409, code: "emailTaken" });
  });

  test("returns field errors for invalid input", async () => {
    const result = await createTestAuth().service.register({ username: "x" }, CLIENT);
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      fields: { username: "usernameTooShort", email: "required", password: "required" },
    });
  });
});

test.describe("login", () => {
  test("accepts the username or the email", async () => {
    const { service } = await registered();
    expect(
      (await service.login({ identifier: "qudu_18", password: VALID_ACCOUNT.password }, CLIENT)).ok,
    ).toBe(true);
    expect(
      (
        await service.login(
          { identifier: "QUDU@EXAMPLE.COM", password: VALID_ACCOUNT.password },
          CLIENT,
        )
      ).ok,
    ).toBe(true);
  });

  test("gives the same error for a wrong password and an unknown user", async () => {
    const { service } = await registered();
    const wrongPassword = await service.login(
      { identifier: "qudu_18", password: "nope-nope" },
      CLIENT,
    );
    const unknownUser = await service.login({ identifier: "ghost", password: "nope-nope" }, CLIENT);
    expect(wrongPassword).toEqual({ ok: false, status: 401, code: "invalidCredentials" });
    expect(unknownUser).toEqual(wrongPassword);
  });

  test("is rate limited per client", async () => {
    const { service } = await registered();
    const attempt = () => service.login({ identifier: "qudu_18", password: "wrong-pass" }, CLIENT);
    for (let index = 0; index < RATE_LIMITS.login.limit; index += 1) {
      expect((await attempt()).ok).toBe(false);
    }
    expect(await attempt()).toMatchObject({ status: 429, code: "rateLimited" });
  });
});

test.describe("refresh tokens", () => {
  test("rotate on every refresh", async () => {
    const { service, session } = await registered();
    const next = await service.refresh(session.refreshToken);
    expect(next.ok).toBe(true);
    expect(next.ok && next.value.refreshToken).not.toBe(session.refreshToken);
  });

  test("revoke the whole family when an old token is reused", async () => {
    const { service, session } = await registered();
    const next = await service.refresh(session.refreshToken);
    expect((await service.refresh(session.refreshToken)).ok).toBe(false);
    expect(next.ok && (await service.refresh(next.value.refreshToken)).ok).toBe(false);
  });

  test("stop working after logout", async () => {
    const { service, session } = await registered();
    await service.logout(session.refreshToken);
    expect(await service.refresh(session.refreshToken)).toMatchObject({ status: 401 });
  });

  test("expire after 30 days", async () => {
    const { service, session, advance } = await registered();
    advance(31 * 24 * 60 * 60 * 1000);
    expect((await service.refresh(session.refreshToken)).ok).toBe(false);
  });
});

test.describe("password reset", () => {
  test("does not reveal whether an email exists", async () => {
    const { service, mails } = await registered();
    const result = await service.forgotPassword(
      { email: "ghost@example.com" },
      CLIENT,
      "https://tftvn.vn",
    );
    expect(result).toEqual({ ok: true, value: null });
    expect(mails).toEqual([]);
  });

  test("emails a localized link and resets the password once", async () => {
    const { service, mails, session } = await registered();
    await service.forgotPassword(
      { email: VALID_ACCOUNT.email, locale: "en" },
      CLIENT,
      "https://tftvn.vn",
    );
    expect(mails).toHaveLength(1);
    expect(mails[0]!.link).toMatch(/^https:\/\/tftvn\.vn\/en\/reset-password\?token=/);
    expect(mails[0]!.locale).toBe("en");

    const token = new URL(mails[0]!.link).searchParams.get("token")!;
    expect(await service.resetPassword({ token, password: "mat-khau-moi-123" })).toEqual({
      ok: true,
      value: null,
    });
    expect(await service.resetPassword({ token, password: "mat-khau-moi-456" })).toMatchObject({
      code: "tokenInvalid",
    });
    expect((await service.refresh(session.refreshToken)).ok).toBe(false);
    expect(
      (await service.login({ identifier: "qudu_18", password: "mat-khau-moi-123" }, CLIENT)).ok,
    ).toBe(true);
  });

  test("rejects links older than 30 minutes", async () => {
    const { service, mails, advance } = await registered();
    await service.forgotPassword({ email: VALID_ACCOUNT.email }, CLIENT, "https://tftvn.vn");
    advance(31 * 60 * 1000);
    const token = new URL(mails[0]!.link).searchParams.get("token")!;
    expect(await service.resetPassword({ token, password: "mat-khau-moi-123" })).toMatchObject({
      status: 400,
      code: "tokenInvalid",
    });
  });

  test("invalidates the previous link when a new one is requested", async () => {
    const { service, mails } = await registered();
    await service.forgotPassword({ email: VALID_ACCOUNT.email }, CLIENT, "https://tftvn.vn");
    await service.forgotPassword({ email: VALID_ACCOUNT.email }, CLIENT, "https://tftvn.vn");
    const first = new URL(mails[0]!.link).searchParams.get("token")!;
    expect((await service.resetPassword({ token: first, password: "mat-khau-moi-123" })).ok).toBe(
      false,
    );
  });
});

test.describe("profile", () => {
  test("updates the username and signs a fresh access token", async () => {
    const { service, memory } = await registered();
    const result = await service.updateProfile(memory.users[0]!, { username: "duc_new" });
    expect(result.ok && result.value.user.username).toBe("duc_new");
    expect(result.ok && result.value.accessToken).toBeTruthy();
  });

  test("refuses a username that belongs to someone else", async () => {
    const { service, memory } = await registered();
    await service.register(
      { username: "other", email: "o@example.com", password: "12345678" },
      CLIENT,
    );
    expect(await service.updateProfile(memory.users[0]!, { username: "Other" })).toMatchObject({
      status: 409,
      code: "usernameTaken",
    });
  });

  test("changes the password only with the current one and keeps this session", async () => {
    const { service, memory, session } = await registered();
    const other = await service.login(
      { identifier: "qudu_18", password: VALID_ACCOUNT.password },
      CLIENT,
    );
    const user = memory.users[0]!;

    expect(
      await service.changePassword(
        user,
        { currentPassword: "wrong", newPassword: "mat-khau-moi-1" },
        session.refreshToken,
      ),
    ).toMatchObject({ code: "currentPasswordWrong" });

    const changed = await service.changePassword(
      user,
      { currentPassword: VALID_ACCOUNT.password, newPassword: "mat-khau-moi-1" },
      session.refreshToken,
    );
    expect(changed.ok).toBe(true);
    expect((await service.refresh(session.refreshToken)).ok).toBe(true);
    expect(other.ok && (await service.refresh(other.value.refreshToken)).ok).toBe(false);
  });
});

test.describe("riot account", () => {
  test("stores an unverified Riot ID when no API key is configured", async () => {
    const { service, memory } = await registered();
    const result = await service.linkRiot(memory.users[0]!, {
      gameName: "Quý Đức",
      tagLine: "VN2",
    });
    expect(result.ok && result.value.riot).toEqual({
      platform: "vn2",
      gameName: "Quý Đức",
      tagLine: "VN2",
      verified: false,
    });
  });

  test("verifies through Riot when the account exists", async () => {
    const { service, memory, setRiot } = await registered();
    setRiot({ status: "found", puuid: "puuid-123" });
    const result = await service.linkRiot(memory.users[0]!, {
      gameName: "Quý Đức",
      tagLine: "VN2",
    });
    expect(result.ok && result.value.riot?.verified).toBe(true);
    expect(memory.users[0]!.riotPuuid).toBe("puuid-123");
  });

  test("reports unknown accounts and Riot outages", async () => {
    const { service, memory, setRiot } = await registered();
    setRiot({ status: "notFound" });
    expect(
      await service.linkRiot(memory.users[0]!, { gameName: "Ghost", tagLine: "VN2" }),
    ).toMatchObject({
      status: 404,
      code: "riotNotFound",
    });
    setRiot({ status: "unavailable" });
    expect(
      await service.linkRiot(memory.users[0]!, { gameName: "Ghost", tagLine: "VN2" }),
    ).toMatchObject({
      status: 503,
    });
  });

  test("unlinks the Riot ID", async () => {
    const { service, memory } = await registered();
    await service.linkRiot(memory.users[0]!, { gameName: "Quý Đức", tagLine: "VN2" });
    expect((await service.unlinkRiot(memory.users[0]!)).riot).toBeNull();
  });
});
