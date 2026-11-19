import { getDb, rateLimits } from "@tftvn/db";
import { sql } from "drizzle-orm";

export async function hitRateLimit(bucket: string, windowSeconds: number): Promise<number> {
  const [row] = await getDb()
    .insert(rateLimits)
    .values({
      bucket,
      windowStart: sql`to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}) * ${windowSeconds})`,
      hits: 1,
    })
    .onConflictDoUpdate({
      target: [rateLimits.bucket, rateLimits.windowStart],
      set: { hits: sql`${rateLimits.hits} + 1` },
    })
    .returning({ hits: rateLimits.hits });
  return row?.hits ?? 1;
}

export function clientKeyFromHeaders(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local"
  );
}
