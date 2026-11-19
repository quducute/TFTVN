import {
  type ChampionData,
  type ItemData,
  type TraitData,
  emblemTrait,
  isEncodablePlannerCode,
} from "@tftvn/core";
import type { Locale } from "@/i18n/routing";
import { getEntities, getLibrarySets, localized } from "../library";
import { isCompItem } from "./catalog";
import type { CompSetData } from "@/lib/comp-set";

export async function getCompSetData(setId: number, locale: Locale): Promise<CompSetData | null> {
  const set = (await getLibrarySets()).find((candidate) => candidate.id === setId);
  if (!set) {
    return null;
  }
  const [champions, traits, items, augments] = await Promise.all([
    getEntities<ChampionData>(set.snapshotId, "champion"),
    getEntities<TraitData>(set.snapshotId, "trait"),
    getEntities<ItemData>(set.snapshotId, "item"),
    getEntities<ItemData>(set.snapshotId, "augment"),
  ]);
  const traitNames = traits.map((trait) => trait.apiName);

  return {
    setId: set.id,
    mutator: set.mutator,
    patch: set.patch,
    champions: champions.map((champion) => ({
      apiName: champion.apiName,
      name: localized(champion, locale).name,
      icon: champion.data.squareIcon ?? champion.data.tileIcon,
      cost: champion.cost ?? 0,
      traits: champion.traits ?? [],
      plannerCode: isEncodablePlannerCode(champion.plannerCode) ? champion.plannerCode : null,
    })),
    traits: traits.map((trait) => ({
      apiName: trait.apiName,
      name: localized(trait, locale).name,
      icon: trait.data.icon,
      breakpoints: trait.data.effects.map((effect) => ({
        minUnits: effect.minUnits,
        style: effect.style,
      })),
    })),
    items: items
      .filter((item) => isCompItem(item.data))
      .map((item) => ({
        apiName: item.apiName,
        name: localized(item, locale).name,
        icon: item.data.icon,
        category: item.data.category!,
        emblemTrait: item.data.category === "emblem" ? emblemTrait(item.apiName, traitNames) : null,
      })),
    augments: augments.map((augment) => ({
      apiName: augment.apiName,
      name: localized(augment, locale).name,
      icon: augment.data.icon,
      tier: augment.data.tier ?? null,
    })),
  };
}
