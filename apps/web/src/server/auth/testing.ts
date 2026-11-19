import { createAccessTokens, sha256 } from "./crypto";
import { createMemoryAuthRepository } from "./memory-repository";
import { createAuthService } from "./service";
import type { RiotLookupResult } from "./types";

export const TEST_JWT_SECRET = "test-secret-that-is-long-enough-123456";

export function createTestAuth() {
  const memory = createMemoryAuthRepository();
  const mails: { to: string; username: string; link: string; locale: "vi" | "en" }[] = [];
  let clock = new Date("2026-11-19T00:00:00Z");
  let riotResult: RiotLookupResult = { status: "unconfigured" };
  let counter = 0;
  let mailFails = false;

  const service = createAuthService({
    repository: memory.repository,
    passwords: {
      hash: async (password) => `hashed:${password}`,
      verify: async (hash, password) => hash === `hashed:${password}`,
    },
    accessTokens: createAccessTokens(() => TEST_JWT_SECRET),
    mailer: {
      sendPasswordReset: async (mail) => {
        if (mailFails) {
          throw new Error("smtp rejected");
        }
        mails.push(mail);
      },
    },
    riot: { findAccount: async () => riotResult },
    randomToken: () => {
      counter += 1;
      return `token-${counter}-abcdefghijklmnopqrstuvwxyz`;
    },
    hashToken: sha256,
    now: () => clock,
  });

  return {
    service,
    memory,
    mails,
    advance(milliseconds: number) {
      clock = new Date(clock.getTime() + milliseconds);
    },
    setRiot(result: RiotLookupResult) {
      riotResult = result;
    },
    failMail(fails: boolean) {
      mailFails = fails;
    },
  };
}

export const VALID_ACCOUNT = {
  username: "qudu_18",
  email: "qudu@example.com",
  password: "mat-khau-an-toan",
};
