import {
  type AuthRepository,
  type TokenKind,
  UniqueViolationError,
  type UserRecord,
} from "./types";

interface StoredToken {
  userId: number;
  kind: TokenKind;
  tokenHash: Buffer;
  expiresAt: Date;
  usedAt: Date | null;
}

export function createMemoryAuthRepository() {
  const users: UserRecord[] = [];
  const tokens: StoredToken[] = [];
  const hits = new Map<string, number>();

  const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
  const assertUnique = (candidate: Partial<UserRecord>, selfId?: number) => {
    for (const user of users) {
      if (user.id === selfId) {
        continue;
      }
      if (candidate.username && same(user.username, candidate.username)) {
        throw new UniqueViolationError("username");
      }
      if (candidate.email && same(user.email, candidate.email)) {
        throw new UniqueViolationError("email");
      }
    }
  };

  const repository: AuthRepository = {
    async findUserById(id) {
      return users.find((user) => user.id === id) ?? null;
    },
    async findUserByLogin(identifier) {
      return (
        users.find((user) => same(user.username, identifier) || same(user.email, identifier)) ??
        null
      );
    },
    async findUserByEmail(email) {
      return users.find((user) => same(user.email, email)) ?? null;
    },
    async createUser(input) {
      assertUnique(input);
      const user: UserRecord = {
        id: users.length + 1,
        ...input,
        role: "user",
        riotPlatform: "vn2",
        riotGameName: null,
        riotTagLine: null,
        riotPuuid: null,
      };
      users.push(user);
      return user;
    },
    async updateUser(id, patch) {
      const user = users.find((candidate) => candidate.id === id);
      if (!user) {
        throw new Error(`User ${id} not found`);
      }
      assertUnique(patch, id);
      Object.assign(user, patch);
      return user;
    },
    async insertToken(input) {
      tokens.push({ ...input, usedAt: null });
    },
    async consumeToken(kind, tokenHash, now) {
      const token = tokens.find(
        (candidate) => candidate.kind === kind && candidate.tokenHash.equals(tokenHash),
      );
      if (!token) {
        return null;
      }
      if (token.usedAt) {
        return { status: "reused", userId: token.userId };
      }
      if (token.expiresAt <= now) {
        return null;
      }
      token.usedAt = now;
      return { status: "valid", userId: token.userId };
    },
    async revokeTokens(userId, kind, exceptHash) {
      for (const token of tokens) {
        if (
          token.userId === userId &&
          token.kind === kind &&
          !token.usedAt &&
          !(exceptHash && token.tokenHash.equals(exceptHash))
        ) {
          token.usedAt = new Date();
        }
      }
    },
    async deleteTokens(userId, kind) {
      for (let index = tokens.length - 1; index >= 0; index -= 1) {
        if (tokens[index]!.userId === userId && tokens[index]!.kind === kind) {
          tokens.splice(index, 1);
        }
      }
    },
    async hitRateLimit(bucket) {
      const next = (hits.get(bucket) ?? 0) + 1;
      hits.set(bucket, next);
      return next;
    },
  };

  return { repository, users, tokens };
}
