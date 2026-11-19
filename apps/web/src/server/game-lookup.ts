import type { ChampionData, ItemData, TraitData } from "@tftvn/core";
import type { Locale } from "@/i18n/routing";
import { type LibraryEntity, getEntities, getLibrarySets, localized } from "./library";

export interface GameEntityInfo {
  name: string;
  icon: string | null;
  cost: number | null;
}

export interface GameLookup {
  champion(apiName: string): GameEntityInfo;
  trait(apiName: string): GameEntityInfo;
  item(apiName: string): GameEntityInfo;
}

export function readableApiName(apiName: string): string {
  const readable = apiName
    .replace(/^(?:TFT\d*|DA)_(?:\d+_)?/, "")
    .replace(/^Item_/, "")
    .replace(/18$/, "")
    .replace(/_/g, " ")
    .trim();
  return readable || apiName;
}

const fallback = (apiName: string): GameEntityInfo => ({
  name: readableApiName(apiName),
  icon: null,
  cost: null,
});

function index<Data>(
  entities: LibraryEntity<Data>[],
  locale: Locale,
  icon: (data: Data) => string | null,
): Map<string, GameEntityInfo> {
  return new Map(
    entities.map((entity) => [
      entity.apiName,
      { name: localized(entity, locale).name, icon: icon(entity.data), cost: entity.cost },
    ]),
  );
}

export async function getGameLookup(setNumber: number, locale: Locale): Promise<GameLookup> {
  const set = (await getLibrarySets()).find((candidate) => candidate.id === setNumber);
  if (!set) {
    return { champion: fallback, trait: fallback, item: fallback };
  }
  const [champions, traits, items] = await Promise.all([
    getEntities<ChampionData>(set.snapshotId, "champion"),
    getEntities<TraitData>(set.snapshotId, "trait"),
    getEntities<ItemData>(set.snapshotId, "item"),
  ]);
  const championMap = index(champions, locale, (data) => data.squareIcon ?? data.tileIcon);
  const traitMap = index(traits, locale, (data) => data.icon);
  const itemMap = index(items, locale, (data) => data.icon);

  return {
    champion: (apiName) => championMap.get(apiName) ?? fallback(apiName),
    trait: (apiName) => traitMap.get(apiName) ?? fallback(apiName),
    item: (apiName) => itemMap.get(apiName) ?? fallback(apiName),
  };
}
