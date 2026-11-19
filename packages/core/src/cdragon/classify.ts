export const ITEM_CATEGORIES = [
  "component",
  "completed",
  "emblem",
  "radiant",
  "artifact",
  "support",
  "consumable",
  "other",
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export interface ItemShape {
  apiName: string;
  composition: readonly string[];
  tags: readonly string[];
}

export function itemCategory({ apiName, composition, tags }: ItemShape): ItemCategory {
  const tagSet = new Set(tags.map((tag) => tag.toLowerCase()));
  if (/Radiant/.test(apiName)) {
    return "radiant";
  }
  if (/Artifact|Ornn/.test(apiName)) {
    return "artifact";
  }
  if (/Support/.test(apiName)) {
    return "support";
  }
  if (/Consumable/.test(apiName) || tagSet.has("consumable")) {
    return "consumable";
  }
  if (/Emblem/.test(apiName)) {
    return "emblem";
  }
  if (composition.length === 2) {
    return "completed";
  }
  if (tagSet.has("component") && /^TFT\d*_Item_/.test(apiName)) {
    return "component";
  }
  return "other";
}

export type AugmentTier = 1 | 2 | 3;

export function augmentTier(icon: string | null | undefined): AugmentTier | null {
  const file = (icon ?? "").toLowerCase().split("/").pop() ?? "";
  const roman = /(?:^|[-_])(i{1,3})\.(?:tex|png|dds)$/.exec(file);
  if (roman) {
    return roman[1]!.length as AugmentTier;
  }
  const numbered = /(?:^|[-_])t([1-3])\.(?:tex|png|dds)$/.exec(file);
  return numbered ? (Number(numbered[1]) as AugmentTier) : null;
}
