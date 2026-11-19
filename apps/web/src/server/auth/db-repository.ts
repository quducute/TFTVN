import { getDb, userTokens, users } from "@tftvn/db";
import { and, eq, gt, isNull, ne, or } from "drizzle-orm";
import { hitRateLimit } from "../rate-limit";
import { type AuthRepository, UniqueViolationError, type UserRecord } from "./types";

const userColumns = {
  id: users.id,
  username: users.username,
  email: users.email,
  passwordHash: users.passwordHash,
  role: users.role,
  riotPlatform: users.riotPlatform,
  riotGameName: users.riotGameName,
  riotTagLine: users.riotTagLine,
  riotPuuid: users.riotPuuid,
};

function asUniqueViolation(error: unknown): never {
  const cause = (error as { cause?: { code?: string; constraint?: string } }).cause;
  if (cause?.code === "23505") {
    throw new UniqueViolationError(cause.constraint?.includes("email") ? "email" : "username");
  }
  throw error;
}

function single(rows: UserRecord[]): UserRecord | null {
  return rows[0] ?? null;
}

export function createDbAuthRepository(): AuthRepository {
  const db = () => getDb();

  return {
    async findUserById(id) {
      return single(await db().select(userColumns).from(users).where(eq(users.id, id)).limit(1));
    },

    async findUserByLogin(identifier) {
      return single(
        await db()
          .select(userColumns)
          .from(users)
          .where(or(eq(users.username, identifier), eq(users.email, identifier)))
          .limit(1),
      );
    },

    async findUserByEmail(email) {
      return single(
        await db().select(userColumns).from(users).where(eq(users.email, email)).limit(1),
      );
    },

    async createUser(input) {
      try {
        const [created] = await db().insert(users).values(input).returning(userColumns);
        return created!;
      } catch (error) {
        return asUniqueViolation(error);
      }
    },

    async updateUser(id, patch) {
      try {
        const [updated] = await db()
          .update(users)
          .set(patch)
          .where(eq(users.id, id))
          .returning(userColumns);
        if (!updated) {
          throw new Error(`User ${id} not found`);
        }
        return updated;
      } catch (error) {
        return asUniqueViolation(error);
      }
    },

    async insertToken({ userId, kind, tokenHash, expiresAt }) {
      await db()
        .insert(userTokens)
        .values({ userId, kind, tokenHash, expiresAt: expiresAt.toISOString() });
    },

    async consumeToken(kind, tokenHash, now) {
      const [claimed] = await db()
        .update(userTokens)
        .set({ usedAt: now.toISOString() })
        .where(
          and(
            eq(userTokens.kind, kind),
            eq(userTokens.tokenHash, tokenHash),
            isNull(userTokens.usedAt),
            gt(userTokens.expiresAt, now.toISOString()),
          ),
        )
        .returning({ userId: userTokens.userId });
      if (claimed) {
        return { status: "valid", userId: claimed.userId };
      }
      const [existing] = await db()
        .select({ userId: userTokens.userId, usedAt: userTokens.usedAt })
        .from(userTokens)
        .where(and(eq(userTokens.kind, kind), eq(userTokens.tokenHash, tokenHash)))
        .limit(1);
      return existing?.usedAt ? { status: "reused", userId: existing.userId } : null;
    },

    async revokeTokens(userId, kind, exceptHash) {
      await db()
        .update(userTokens)
        .set({ usedAt: new Date().toISOString() })
        .where(
          and(
            eq(userTokens.userId, userId),
            eq(userTokens.kind, kind),
            isNull(userTokens.usedAt),
            exceptHash ? ne(userTokens.tokenHash, exceptHash) : undefined,
          ),
        );
    },

    async deleteTokens(userId, kind) {
      await db()
        .delete(userTokens)
        .where(and(eq(userTokens.userId, userId), eq(userTokens.kind, kind)));
    },

    hitRateLimit,
  };
}
