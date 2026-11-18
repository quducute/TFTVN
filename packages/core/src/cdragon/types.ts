export type RawNumber = number | null;

export type RawValues = Record<string, RawNumber>;

export interface RawItem {
  apiName: string;
  name: string | null;
  desc: string | null;
  icon: string | null;
  effects: RawValues | null;
  composition: string[] | null;
  tags: string[] | null;
  associatedTraits: string[] | null;
  incompatibleTraits: string[] | null;
  unique: boolean | null;
  isAugment?: boolean | null;
}

export interface RawAbilityVariable {
  name: string;
  value: RawNumber[] | null;
}

export interface RawAbility {
  name: string | null;
  desc: string | null;
  icon: string | null;
  variables: RawAbilityVariable[] | null;
}

export interface RawChampion {
  apiName: string;
  characterName: string | null;
  name: string | null;
  cost: number;
  role: string | null;
  traits: string[] | null;
  stats: RawValues | null;
  ability: RawAbility | null;
  icon: string | null;
  squareIcon: string | null;
  tileIcon: string | null;
}

export interface RawTraitEffect {
  minUnits: number;
  maxUnits: number;
  style: number;
  variables: RawValues | null;
}

export interface RawTrait {
  apiName: string;
  name: string | null;
  desc: string | null;
  icon: string | null;
  effects: RawTraitEffect[] | null;
}

export interface RawSetData {
  number: number;
  mutator: string;
  name: string;
  champions: RawChampion[];
  traits: RawTrait[];
  items: string[];
  augments: string[];
}

export interface RawGameData {
  items: RawItem[];
  setData: RawSetData[];
}

export interface RawTeamPlannerChampion {
  character_id: string;
  team_planner_code: number;
}

export type RawTeamPlanner = Record<string, RawTeamPlannerChampion[]>;
