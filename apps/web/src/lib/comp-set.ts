import {
  type AugmentTier,
  type CompUnit,
  type ItemCategory,
  type TraitCount,
  countTraits,
} from "@tftvn/core";

export interface SetChampion {
  apiName: string;
  name: string;
  icon: string | null;
  cost: number;
  traits: string[];
  plannerCode: string | null;
}

export interface SetTrait {
  apiName: string;
  name: string;
  icon: string | null;
  breakpoints: { minUnits: number; style: number }[];
}

export interface SetItem {
  apiName: string;
  name: string;
  icon: string | null;
  category: ItemCategory;
  emblemTrait: string | null;
}

export interface SetAugment {
  apiName: string;
  name: string;
  icon: string | null;
  tier: AugmentTier | null;
}

export interface CompSetData {
  setId: number;
  mutator: string;
  patch: string;
  champions: SetChampion[];
  traits: SetTrait[];
  items: SetItem[];
  augments: SetAugment[];
}

export function indexSetData(data: CompSetData) {
  return {
    champions: new Map(data.champions.map((champion) => [champion.apiName, champion])),
    traits: new Map(data.traits.map((trait) => [trait.apiName, trait])),
    items: new Map(data.items.map((item) => [item.apiName, item])),
    augments: new Map(data.augments.map((augment) => [augment.apiName, augment])),
  };
}

export type IndexedSetData = ReturnType<typeof indexSetData>;

export function boardTraits(board: readonly CompUnit[], index: IndexedSetData): TraitCount[] {
  return countTraits(
    board.map((unit) => ({
      championApiName: unit.championApiName,
      traits: index.champions.get(unit.championApiName)?.traits ?? [],
      emblemTraits: unit.items
        .map((item) => index.items.get(item)?.emblemTrait)
        .filter((trait): trait is string => trait != null),
    })),
    index.traits,
  );
}
