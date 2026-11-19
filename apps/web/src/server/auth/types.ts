import type { AuthErrorCode, FieldErrors } from "@tftvn/core";

export type UserRole = "user" | "admin";
export type TokenKind = "refresh" | "password_reset" | "email_verify";

export interface UserRecord {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  riotPlatform: string;
  riotGameName: string | null;
  riotTagLine: string | null;
  riotPuuid: string | null;
}

export interface PublicUser {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  riot: { platform: string; gameName: string; tagLine: string; verified: boolean } | null;
}

export type UserPatch = Partial<
  Pick<
    UserRecord,
    "username" | "email" | "passwordHash" | "riotGameName" | "riotTagLine" | "riotPuuid"
  >
>;

export type ConsumedToken =
  { status: "valid"; userId: number } | { status: "reused"; userId: number };

export class UniqueViolationError extends Error {
  constructor(readonly field: "username" | "email") {
    super(`${field} already exists`);
  }
}

export interface AuthRepository {
  findUserById(id: number): Promise<UserRecord | null>;
  findUserByLogin(identifier: string): Promise<UserRecord | null>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  createUser(input: { username: string; email: string; passwordHash: string }): Promise<UserRecord>;
  updateUser(id: number, patch: UserPatch): Promise<UserRecord>;
  insertToken(input: {
    userId: number;
    kind: TokenKind;
    tokenHash: Buffer;
    expiresAt: Date;
  }): Promise<void>;
  consumeToken(kind: TokenKind, tokenHash: Buffer, now: Date): Promise<ConsumedToken | null>;
  revokeTokens(userId: number, kind: TokenKind, exceptHash?: Buffer): Promise<void>;
  deleteTokens(userId: number, kind: TokenKind): Promise<void>;
  hitRateLimit(bucket: string, windowSeconds: number): Promise<number>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

export interface AccessTokenClaims {
  userId: number;
  username: string;
  role: UserRole;
}

export interface AccessTokens {
  sign(claims: AccessTokenClaims): Promise<string>;
  verify(token: string): Promise<AccessTokenClaims | null>;
}

export interface Mailer {
  sendPasswordReset(input: { to: string; link: string; locale: "vi" | "en" }): Promise<void>;
}

export type RiotLookupResult =
  | { status: "found"; puuid: string }
  | { status: "notFound" }
  | { status: "unconfigured" }
  | { status: "unavailable" };

export interface RiotAccountLookup {
  findAccount(gameName: string, tagLine: string): Promise<RiotLookupResult>;
}

export interface Session {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export type ServiceResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      status: 400 | 401 | 404 | 409 | 429 | 503;
      code: AuthErrorCode;
      fields?: FieldErrors;
    };
