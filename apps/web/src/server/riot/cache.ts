import { getDb, riotCache } from "@tftvn/db";
import { and, eq, gt } from "drizzle-orm";

export interface CacheStore {
  read(key: string, now: Date): Promise<unknown>;
  write(key: string, value: unknown, expiresAt: Date): Promise<void>;
}

export const dbCacheStore: CacheStore = {
  async read(key, now) {
    const [row] = await getDb()
      .select({ value: riotCache.value })
      .from(riotCache)
      .where(and(eq(riotCache.key, key), gt(riotCache.expiresAt, now.toISOString())))
      .limit(1);
    return row?.value;
  },
  async write(key, value, expiresAt) {
    await getDb()
      .insert(riotCache)
      .values({ key, value, expiresAt: expiresAt.toISOString() })
      .onConflictDoUpdate({
        target: riotCache.key,
        set: { value, expiresAt: expiresAt.toISOString() },
      });
  },
};

export function createCache(store: CacheStore, now: () => Date = () => new Date()) {
  return async function cached<T>(
    key: string,
    ttlSeconds: number,
    load: () => Promise<T>,
  ): Promise<T> {
    const hit = await store.read(key, now());
    if (hit !== undefined) {
      return hit as T;
    }
    const value = await load();
    await store.write(key, value, new Date(now().getTime() + ttlSeconds * 1000));
    return value;
  };
}

export type Cached = ReturnType<typeof createCache>;
