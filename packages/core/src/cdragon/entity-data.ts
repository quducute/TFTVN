import type { AugmentTier, ItemCategory } from "./classify";
import type { LookupValue } from "./description";
import type { RawNumber } from "./types";

export interface ChampionData {
  stats: Record<string, RawNumber>;
  icon: string | null;
  squareIcon: string | null;
  tileIcon: string | null;
  ability: { icon: string | null; variables: Record<string, LookupValue> };
}

export interface TraitBreakpoint {
  minUnits: number;
  maxUnits: number;
  style: number;
  variables: Record<string, RawNumber>;
}

export interface TraitData {
  icon: string | null;
  effects: TraitBreakpoint[];
}

export interface ItemData {
  icon: string | null;
  effects: Record<string, RawNumber>;
  composition: string[];
  tags: string[];
  unique: boolean;
  associatedTraits: string[];
  incompatibleTraits: string[];
  category?: ItemCategory;
  tier?: AugmentTier | null;
}
