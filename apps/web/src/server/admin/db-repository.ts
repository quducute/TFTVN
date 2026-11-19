import { championRoles, getDb, roleItems, users } from "@tftvn/db";
import { and, eq, sql } from "drizzle-orm";
import { getEntities, getLibrarySets } from "../library";
import { COMP_ITEM_CATEGORIES } from "../comps/catalog";
import type { ItemData } from "@tftvn/core";
import type { AdminCatalog, AdminRepository } from "./service";

export const dbAdminRepository: AdminRepository = {
  async setUserRole(userId, role) {
    const rows = await getDb()
      .update(users)
      .set({ role })
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    return rows.length > 0;
  },

  async setChampionRole(setId, championApiName, roleApiName, userId) {
    if (!roleApiName) {
      await getDb()
        .delete(championRoles)
        .where(
          and(eq(championRoles.setId, setId), eq(championRoles.championApiName, championApiName)),
        );
      return;
    }
    await getDb()
      .insert(championRoles)
      .values({ setId, championApiName, roleApiName, updatedBy: userId })
      .onConflictDoUpdate({
        target: [championRoles.setId, championRoles.championApiName],
        set: { roleApiName, updatedBy: userId, updatedAt: sql`now()` },
      });
  },

  async setRoleItems(setId, roleApiName, items, userId) {
    await getDb()
      .insert(roleItems)
      .values({ setId, roleApiName, items, updatedBy: userId })
      .onConflictDoUpdate({
        target: [roleItems.setId, roleItems.roleApiName],
        set: { items, updatedBy: userId },
      });
  },
};

export async function loadAdminCatalog(setId: number): Promise<AdminCatalog | null> {
  const set = (await getLibrarySets()).find((candidate) => candidate.id === setId);
  if (!set) {
    return null;
  }
  const [champions, roles, items] = await Promise.all([
    getEntities(set.snapshotId, "champion"),
    getEntities(set.snapshotId, "role"),
    getEntities<ItemData>(set.snapshotId, "item"),
  ]);
  return {
    champions: new Set(champions.map((champion) => champion.apiName)),
    roles: new Set(roles.map((role) => role.apiName)),
    items: new Set(
      items
        .filter((item) => item.data.category && COMP_ITEM_CATEGORIES.includes(item.data.category))
        .map((item) => item.apiName),
    ),
  };
}
