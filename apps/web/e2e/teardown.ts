import { articles, championRoles, comps, rateLimits, roleItems, users } from "@tftvn/db";
import { createNodeDb } from "@tftvn/db/node";
import { inArray, like } from "drizzle-orm";

export default async function teardown() {
  const url = process.env.DATABASE_URL_DIRECT;
  if (!url) {
    return;
  }
  const { db, close } = createNodeDb(url);
  try {
    const e2eUsers = db
      .select({ id: users.id })
      .from(users)
      .where(like(users.username, String.raw`e2e\_%`));
    await db.delete(articles).where(inArray(articles.authorId, e2eUsers));
    await db
      .update(articles)
      .set({ reviewedBy: null })
      .where(inArray(articles.reviewedBy, e2eUsers));
    await db
      .update(championRoles)
      .set({ updatedBy: null })
      .where(inArray(championRoles.updatedBy, e2eUsers));
    await db
      .update(roleItems)
      .set({ updatedBy: null })
      .where(inArray(roleItems.updatedBy, e2eUsers));
    await db.delete(comps).where(inArray(comps.ownerId, e2eUsers));
    await db.delete(users).where(like(users.username, String.raw`e2e\_%`));
    await db.delete(rateLimits);
  } finally {
    await close();
  }
}
