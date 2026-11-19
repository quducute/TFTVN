import {
  type AuthErrorCode,
  type FieldErrors,
  changePasswordSchema,
  dropEmptyStrings,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  riotIdSchema,
  toFieldErrors,
  updateProfileSchema,
} from "@tftvn/core";
import type { ZodType } from "zod";
import { PASSWORD_RESET_SECONDS, REFRESH_TOKEN_SECONDS } from "./crypto";
import {
  type AccessTokens,
  type AuthRepository,
  type Mailer,
  type PasswordHasher,
  type PublicUser,
  type RiotAccountLookup,
  type ServiceResult,
  type Session,
  UniqueViolationError,
  type UserRecord,
} from "./types";

export interface AuthServiceDependencies {
  repository: AuthRepository;
  passwords: PasswordHasher;
  accessTokens: AccessTokens;
  mailer: Mailer;
  riot: RiotAccountLookup;
  randomToken: () => string;
  hashToken: (token: string) => Buffer;
  now: () => Date;
}

export const RATE_LIMITS = {
  register: { limit: 5, windowSeconds: 60 * 60 },
  login: { limit: 20, windowSeconds: 5 * 60 },
  forgotPassword: { limit: 5, windowSeconds: 60 * 60 },
} as const;

type RateLimitedAction = keyof typeof RATE_LIMITS;

function fail<T>(
  status: 400 | 401 | 404 | 409 | 429 | 503,
  code: AuthErrorCode,
  fields?: FieldErrors,
): ServiceResult<T> {
  return fields ? { ok: false, status, code, fields } : { ok: false, status, code };
}

function parse<T>(schema: ZodType<T>, input: unknown): ServiceResult<T> {
  const result = schema.safeParse(dropEmptyStrings(input));
  if (result.success) {
    return { ok: true, value: result.data };
  }
  const fields = toFieldErrors(result.error);
  return fail(400, Object.values(fields)[0] ?? "unknown", fields);
}

function uniqueFailure<T>(error: unknown): ServiceResult<T> {
  if (error instanceof UniqueViolationError) {
    const code = error.field === "email" ? "emailTaken" : "usernameTaken";
    return fail(409, code, { [error.field]: code });
  }
  throw error;
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    riot:
      user.riotGameName && user.riotTagLine
        ? {
            platform: user.riotPlatform,
            gameName: user.riotGameName,
            tagLine: user.riotTagLine,
            verified: user.riotPuuid != null,
          }
        : null,
  };
}

export function createAuthService(deps: AuthServiceDependencies) {
  const { repository, passwords, accessTokens, mailer, riot } = deps;

  const later = (seconds: number) => new Date(deps.now().getTime() + seconds * 1000);

  let dummyPasswordHash: Promise<string> | undefined;
  const unknownUserHash = () => (dummyPasswordHash ??= passwords.hash(deps.randomToken()));

  async function issueSession(user: UserRecord): Promise<Session> {
    const refreshToken = deps.randomToken();
    await repository.insertToken({
      userId: user.id,
      kind: "refresh",
      tokenHash: deps.hashToken(refreshToken),
      expiresAt: later(REFRESH_TOKEN_SECONDS),
    });
    const accessToken = await accessTokens.sign({
      userId: user.id,
      username: user.username,
      role: user.role,
    });
    return { user: toPublicUser(user), accessToken, refreshToken };
  }

  async function withinRateLimit(action: RateLimitedAction, clientKey: string) {
    const { limit, windowSeconds } = RATE_LIMITS[action];
    const hits = await repository.hitRateLimit(`${action}:${clientKey}`, windowSeconds);
    return hits <= limit;
  }

  return {
    async register(input: unknown, clientKey: string): Promise<ServiceResult<Session>> {
      const parsed = parse(registerSchema, input);
      if (!parsed.ok) {
        return parsed;
      }
      if (!(await withinRateLimit("register", clientKey))) {
        return fail(429, "rateLimited");
      }
      try {
        const user = await repository.createUser({
          username: parsed.value.username,
          email: parsed.value.email,
          passwordHash: await passwords.hash(parsed.value.password),
        });
        return { ok: true, value: await issueSession(user) };
      } catch (error) {
        return uniqueFailure(error);
      }
    },

    async login(input: unknown, clientKey: string): Promise<ServiceResult<Session>> {
      const parsed = parse(loginSchema, input);
      if (!parsed.ok) {
        return parsed;
      }
      if (!(await withinRateLimit("login", clientKey))) {
        return fail(429, "rateLimited");
      }
      const user = await repository.findUserByLogin(parsed.value.identifier);
      const valid = await passwords.verify(
        user?.passwordHash ?? (await unknownUserHash()),
        parsed.value.password,
      );
      if (!user || !valid) {
        return fail(401, "invalidCredentials");
      }
      return { ok: true, value: await issueSession(user) };
    },

    async refresh(refreshToken: string | undefined): Promise<ServiceResult<Session>> {
      if (!refreshToken) {
        return fail(401, "unauthorized");
      }
      const consumed = await repository.consumeToken(
        "refresh",
        deps.hashToken(refreshToken),
        deps.now(),
      );
      if (!consumed) {
        return fail(401, "unauthorized");
      }
      if (consumed.status === "reused") {
        await repository.revokeTokens(consumed.userId, "refresh");
        return fail(401, "unauthorized");
      }
      const user = await repository.findUserById(consumed.userId);
      return user ? { ok: true, value: await issueSession(user) } : fail(401, "unauthorized");
    },

    async logout(refreshToken: string | undefined): Promise<void> {
      if (refreshToken) {
        await repository.consumeToken("refresh", deps.hashToken(refreshToken), deps.now());
      }
    },

    async currentUser(accessToken: string | undefined): Promise<UserRecord | null> {
      const claims = accessToken ? await accessTokens.verify(accessToken) : null;
      return claims ? repository.findUserById(claims.userId) : null;
    },

    async forgotPassword(
      input: unknown,
      clientKey: string,
      origin: string,
    ): Promise<ServiceResult<null>> {
      const parsed = parse(forgotPasswordSchema, input);
      if (!parsed.ok) {
        return parsed;
      }
      if (!(await withinRateLimit("forgotPassword", clientKey))) {
        return fail(429, "rateLimited");
      }
      const user = await repository.findUserByEmail(parsed.value.email);
      if (user) {
        const token = deps.randomToken();
        await repository.deleteTokens(user.id, "password_reset");
        await repository.insertToken({
          userId: user.id,
          kind: "password_reset",
          tokenHash: deps.hashToken(token),
          expiresAt: later(PASSWORD_RESET_SECONDS),
        });
        const prefix = parsed.value.locale === "en" ? "/en" : "";
        await mailer
          .sendPasswordReset({
            to: user.email,
            link: `${origin}${prefix}/reset-password?token=${encodeURIComponent(token)}`,
            locale: parsed.value.locale,
          })
          .catch((error: unknown) => console.error("Password reset mail failed", error));
      }
      return { ok: true, value: null };
    },

    async resetPassword(input: unknown): Promise<ServiceResult<null>> {
      const parsed = parse(resetPasswordSchema, input);
      if (!parsed.ok) {
        return parsed;
      }
      const consumed = await repository.consumeToken(
        "password_reset",
        deps.hashToken(parsed.value.token),
        deps.now(),
      );
      if (!consumed || consumed.status === "reused") {
        return fail(400, "tokenInvalid", { token: "tokenInvalid" });
      }
      await repository.updateUser(consumed.userId, {
        passwordHash: await passwords.hash(parsed.value.password),
      });
      await repository.revokeTokens(consumed.userId, "refresh");
      return { ok: true, value: null };
    },

    async updateProfile(
      user: UserRecord,
      input: unknown,
    ): Promise<ServiceResult<{ user: PublicUser; accessToken: string }>> {
      const parsed = parse(updateProfileSchema, input);
      if (!parsed.ok) {
        return parsed;
      }
      try {
        const updated = await repository.updateUser(user.id, parsed.value);
        const accessToken = await accessTokens.sign({
          userId: updated.id,
          username: updated.username,
          role: updated.role,
        });
        return { ok: true, value: { user: toPublicUser(updated), accessToken } };
      } catch (error) {
        return uniqueFailure(error);
      }
    },

    async changePassword(
      user: UserRecord,
      input: unknown,
      currentRefreshToken: string | undefined,
    ): Promise<ServiceResult<null>> {
      const parsed = parse(changePasswordSchema, input);
      if (!parsed.ok) {
        return parsed;
      }
      if (!(await passwords.verify(user.passwordHash, parsed.value.currentPassword))) {
        return fail(400, "currentPasswordWrong", { currentPassword: "currentPasswordWrong" });
      }
      await repository.updateUser(user.id, {
        passwordHash: await passwords.hash(parsed.value.newPassword),
      });
      await repository.revokeTokens(
        user.id,
        "refresh",
        currentRefreshToken ? deps.hashToken(currentRefreshToken) : undefined,
      );
      return { ok: true, value: null };
    },

    async linkRiot(user: UserRecord, input: unknown): Promise<ServiceResult<PublicUser>> {
      const parsed = parse(riotIdSchema, input);
      if (!parsed.ok) {
        return parsed;
      }
      const lookup = await riot.findAccount(parsed.value.gameName, parsed.value.tagLine);
      if (lookup.status === "notFound") {
        return fail(404, "riotNotFound", { gameName: "riotNotFound" });
      }
      if (lookup.status === "unavailable") {
        return fail(503, "riotUnavailable");
      }
      const updated = await repository.updateUser(user.id, {
        riotGameName: parsed.value.gameName,
        riotTagLine: parsed.value.tagLine,
        riotPuuid: lookup.status === "found" ? lookup.puuid : null,
      });
      return { ok: true, value: toPublicUser(updated) };
    },

    async unlinkRiot(user: UserRecord): Promise<PublicUser> {
      const updated = await repository.updateUser(user.id, {
        riotGameName: null,
        riotTagLine: null,
        riotPuuid: null,
      });
      return toPublicUser(updated);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
