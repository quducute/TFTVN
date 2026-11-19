import type { GameEntityKind, LocalizedEntity } from "@tftvn/core";
import { championRoles, gameEntities, gameSets, getDb, patches, roleItems } from "@tftvn/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import type { Locale } from "@/i18n/routing";
import { rolesTag } from "./cache-tags";

export const GAMEDATA_TAG = "gamedata";
export { rolesTag } from "./cache-tags";

export interface LibrarySet {
  id: number;
  mutator: string;
  isCurrent: boolean;
  patch: string;
  snapshotId: number;
}

export interface LibraryEntity<Data = Record<string, unknown>> {
  kind: GameEntityKind;
  apiName: string;
  i18n: Record<Locale, LocalizedEntity>;
  data: Data;
  cost: number | null;
  traits: string[] | null;
  roleApiName: string | null;
  plannerCode: string | null;
}

export async function getLibrarySets(): Promise<LibrarySet[]> {
  "use cache";
  cacheLife("max");
  cacheTag(GAMEDATA_TAG);

  const rows = await getDb()
    .select({
      id: gameSets.id,
      mutator: gameSets.mutator,
      isCurrent: gameSets.isCurrent,
      patch: patches.id,
      snapshotId: patches.snapshotId,
    })
    .from(gameSets)
    .innerJoin(patches, eq(patches.setId, gameSets.id))
    .orderBy(desc(gameSets.id), desc(patches.isCurrent), desc(patches.releasedAt));

  const latestBySet = new Map<number, LibrarySet>();
  for (const row of rows) {
    if (!latestBySet.has(row.id)) {
      latestBySet.set(row.id, row);
    }
  }
  return [...latestBySet.values()];
}

export async function findLibrarySet(setId: number): Promise<LibrarySet | null> {
  const sets = await getLibrarySets();
  return sets.find((set) => set.id === setId) ?? null;
}

export async function getCurrentLibrarySet(): Promise<LibrarySet | null> {
  const sets = await getLibrarySets();
  return sets.find((set) => set.isCurrent) ?? sets[0] ?? null;
}

export async function getEntities<Data = Record<string, unknown>>(
  snapshotId: number,
  kind: GameEntityKind,
): Promise<LibraryEntity<Data>[]> {
  "use cache";
  cacheLife("max");
  cacheTag(`snapshot:${snapshotId}`);

  const rows = await getDb()
    .select({
      kind: gameEntities.kind,
      apiName: gameEntities.apiName,
      i18n: gameEntities.i18n,
      data: gameEntities.data,
      cost: gameEntities.cost,
      traits: gameEntities.traits,
      roleApiName: gameEntities.roleApiName,
      plannerCode: gameEntities.plannerCode,
    })
    .from(gameEntities)
    .where(and(eq(gameEntities.snapshotId, snapshotId), eq(gameEntities.kind, kind)))
    .orderBy(asc(gameEntities.cost), asc(gameEntities.apiName));

  return rows as LibraryEntity<Data>[];
}

export async function getEntityCounts(snapshotId: number): Promise<Record<GameEntityKind, number>> {
  const kinds: GameEntityKind[] = ["champion", "trait", "item", "augment", "role"];
  const lists = await Promise.all(kinds.map((kind) => getEntities(snapshotId, kind)));
  return Object.fromEntries(kinds.map((kind, index) => [kind, lists[index]!.length])) as Record<
    GameEntityKind,
    number
  >;
}

export async function getChampionRoleAssignments(setId: number): Promise<Record<string, string>> {
  "use cache";
  cacheLife("max");
  cacheTag(rolesTag(setId));

  const rows = await getDb()
    .select({ champion: championRoles.championApiName, role: championRoles.roleApiName })
    .from(championRoles)
    .where(eq(championRoles.setId, setId));
  return Object.fromEntries(rows.map((row) => [row.champion, row.role]));
}

export async function getRoleItemMap(setId: number): Promise<Record<string, string[]>> {
  "use cache";
  cacheLife("max");
  cacheTag(rolesTag(setId));

  const rows = await getDb()
    .select({ role: roleItems.roleApiName, items: roleItems.items })
    .from(roleItems)
    .where(eq(roleItems.setId, setId));
  return Object.fromEntries(rows.map((row) => [row.role, row.items]));
}

export function localized(entity: LibraryEntity<unknown>, locale: Locale): LocalizedEntity {
  return entity.i18n[locale] ?? entity.i18n.vi;
}
