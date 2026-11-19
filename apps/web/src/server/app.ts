import { revalidateTag } from "next/cache";
import { argon2Hasher, createAccessTokens, randomToken, sha256 } from "./auth/crypto";
import { createDbAuthRepository } from "./auth/db-repository";
import { createGmailTransport, createMailer } from "./auth/mailer";
import { createRiotAccountLookup } from "./auth/riot-account";
import { createAuthService } from "./auth/service";
import { randomUUID } from "node:crypto";
import { dbAdminRepository, loadAdminCatalog } from "./admin/db-repository";
import { createAdminService } from "./admin/service";
import { createDbArticleRepository, resolveCompIds } from "./articles/db-repository";
import { createArticleService } from "./articles/service";
import { loadCompCatalog } from "./comps/catalog";
import { createDbCompRepository } from "./comps/db-repository";
import { createCompService } from "./comps/service";
import { createApp } from "./create-app";
import { findLibrarySet } from "./library";
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

const compService = createCompService({
  repository: createDbCompRepository(),
  catalog: loadCompCatalog,
  newPublicId: randomUUID,
  now: () => new Date(),
});

const articleService = createArticleService({
  repository: createDbArticleRepository(),
  setExists: async (setId) => (await findLibrarySet(setId)) != null,
  resolveComps: resolveCompIds,
  newPublicId: randomUUID,
  now: () => new Date(),
});

const expireNow = (tag: string) => revalidateTag(tag, { expire: 0 });

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
  comps: { service: compService, expireTag: expireNow },
  articles: { service: articleService, expireTag: expireNow },
  admin: {
    service: createAdminService({ repository: dbAdminRepository, catalog: loadAdminCatalog }),
    expireTag: expireNow,
  },
});
