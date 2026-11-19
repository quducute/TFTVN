import { revalidateTag } from "next/cache";
import { argon2Hasher, createAccessTokens, randomToken, sha256 } from "./auth/crypto";
import { createDbAuthRepository } from "./auth/db-repository";
import { createGmailTransport, createMailer } from "./auth/mailer";
import { createRiotAccountLookup } from "./auth/riot-account";
import { createAuthService } from "./auth/service";
import { createApp } from "./create-app";
import { getDatabaseVersion } from "./status";

const env = process.env;

const authService = createAuthService({
  repository: createDbAuthRepository(),
  passwords: argon2Hasher,
  accessTokens: createAccessTokens(() => env.JWT_SECRET),
  mailer: createMailer({
    transport: createGmailTransport({ user: env.SMTP_USER, appPassword: env.SMTP_APP_PASSWORD }),
    from: env.MAIL_FROM ?? (env.SMTP_USER ? `TFTVN <${env.SMTP_USER}>` : undefined),
  }),
  riot: createRiotAccountLookup(env.RIOT_API_KEY),
  randomToken,
  hashToken: sha256,
  now: () => new Date(),
});

export const app = createApp({
  revalidateSecret: () => env.REVALIDATE_SECRET,
  revalidate: revalidateTag,
  databaseVersion: getDatabaseVersion,
  auth: {
    service: authService,
    options: {
      secureCookies: env.NODE_ENV === "production",
      allowedOrigins: (env.APP_ORIGINS ?? "").split(",").filter(Boolean),
    },
  },
});
