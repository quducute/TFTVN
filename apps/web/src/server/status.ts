import { getDb } from "@tftvn/db";
import { sql } from "drizzle-orm";

export async function getDatabaseVersion() {
  const result = await getDb().execute<{ server_version: string }>(sql`show server_version`);
  return result.rows[0]?.server_version ?? null;
}
