import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { SignJWT, jwtVerify } from "jose";
import type { AccessTokenClaims, AccessTokens, PasswordHasher, UserRole } from "./types";

export const ACCESS_TOKEN_SECONDS = 15 * 60;
export const REFRESH_TOKEN_SECONDS = 30 * 24 * 60 * 60;
export const PASSWORD_RESET_SECONDS = 30 * 60;

const ISSUER = "tftvn";

export const argon2Hasher: PasswordHasher = {
  hash: (password) => hash(password),
  verify: async (passwordHash, password) => {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  },
};

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

export function createAccessTokens(secret: () => string | undefined): AccessTokens {
  const key = () => {
    const value = secret() ?? "";
    if (value.length < 32) {
      throw new Error("JWT_SECRET must be at least 32 characters");
    }
    return new TextEncoder().encode(value);
  };
  return {
    sign: async (claims) =>
      new SignJWT({ username: claims.username, role: claims.role })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(String(claims.userId))
        .setIssuer(ISSUER)
        .setIssuedAt()
        .setExpirationTime(`${ACCESS_TOKEN_SECONDS}s`)
        .sign(key()),
    verify: async (token) => {
      try {
        const { payload } = await jwtVerify(token, key(), {
          issuer: ISSUER,
          algorithms: ["HS256"],
        });
        const userId = Number(payload.sub);
        if (!Number.isInteger(userId) || typeof payload.username !== "string") {
          return null;
        }
        const role: UserRole = payload.role === "admin" ? "admin" : "user";
        return { userId, username: payload.username, role } satisfies AccessTokenClaims;
      } catch {
        return null;
      }
    },
  };
}
