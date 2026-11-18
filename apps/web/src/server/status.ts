import { gameSets, getDb } from "@tftvn/db";
import { eq, sql } from "drizzle-orm";

export async function getDatabaseVersion() {
  const result = await getDb().execute<{ server_version: string }>(sql`show server_version`);
  return result.rows[0]?.server_version ?? null;
}

export async function getCurrentSet() {
  const [current] = await getDb()
    .select({ id: gameSets.id, name: gameSets.name })
    .from(gameSets)
    .where(eq(gameSets.isCurrent, true))
    .limit(1);
  return current ?? null;
}
