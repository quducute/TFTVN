import { getDb, users } from "@tftvn/db";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createAccessTokens } from "./crypto";
import { ACCESS_COOKIE } from "./guards";
import type { AccessTokenClaims } from "./types";

const accessTokens = createAccessTokens(() => process.env.JWT_SECRET);

export async function getViewer(): Promise<AccessTokenClaims | null> {
  await connection();
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const claims = token ? await accessTokens.verify(token) : null;
  if (!claims) {
    return null;
  }
  const [user] = await getDb()
    .select({ username: users.username, role: users.role })
    .from(users)
    .where(eq(users.id, claims.userId))
    .limit(1);
  return user ? { userId: claims.userId, username: user.username, role: user.role } : null;
}
