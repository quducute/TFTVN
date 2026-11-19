import { getDb, users } from "@tftvn/db";
import { count, desc, ilike, or } from "drizzle-orm";

export const USER_PAGE_SIZE = 20;

export interface AdminUserRow {
  id: number;
  username: string;
  email: string;
  role: "user" | "admin";
  createdAt: string;
}

const escapeLike = (value: string) => value.replaceAll(/[%_\\]/g, (character) => `\\${character}`);

export async function listUsers(query: string, page: number) {
  const current = Math.max(1, Math.trunc(page) || 1);
  const term = escapeLike(query.trim());
  const where = term
    ? or(ilike(users.username, `%${term}%`), ilike(users.email, `%${term}%`))
    : undefined;
  const [rows, [total]] = await Promise.all([
    getDb()
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.role), desc(users.createdAt))
      .limit(USER_PAGE_SIZE)
      .offset((current - 1) * USER_PAGE_SIZE),
    getDb().select({ value: count() }).from(users).where(where),
  ]);
  const totalCount = total?.value ?? 0;
  return {
    rows: rows as AdminUserRow[],
    page: current,
    pages: Math.max(1, Math.ceil(totalCount / USER_PAGE_SIZE)),
  };
}
