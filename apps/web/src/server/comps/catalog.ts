import type { ItemCategory, ItemData } from "@tftvn/core";
import { getEntities, getLibrarySets } from "../library";
import type { CompCatalog } from "./types";

export const COMP_ITEM_CATEGORIES: readonly ItemCategory[] = [
  "completed",
  "emblem",
  "radiant",
  "artifact",
  "support",
];

export const isCompItem = (data: ItemData) =>
  data.category != null && COMP_ITEM_CATEGORIES.includes(data.category);

export async function loadCompCatalog(setId: number): Promise<CompCatalog | null> {
  const set = (await getLibrarySets()).find((candidate) => candidate.id === setId);
  if (!set?.isCurrent) {
    return null;
  }
  const [champions, items, augments] = await Promise.all([
    getEntities(set.snapshotId, "champion"),
    getEntities<ItemData>(set.snapshotId, "item"),
    getEntities(set.snapshotId, "augment"),
  ]);
  return {
    setId: set.id,
    currentPatchId: set.patch,
    champions: new Set(champions.map((champion) => champion.apiName)),
    items: new Set(items.filter((item) => isCompItem(item.data)).map((item) => item.apiName)),
    augments: new Set(augments.map((augment) => augment.apiName)),
  };
}
