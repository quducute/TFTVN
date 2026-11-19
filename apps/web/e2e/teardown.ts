import { rateLimits, users } from "@tftvn/db";
import { createNodeDb } from "@tftvn/db/node";
import { like } from "drizzle-orm";

export default async function teardown() {
  const url = process.env.DATABASE_URL_DIRECT;
  if (!url) {
    return;
  }
  const { db, close } = createNodeDb(url);
  try {
    await db.delete(users).where(like(users.username, "e2e\\_%"));
    await db.delete(rateLimits);
  } finally {
    await close();
  }
}
