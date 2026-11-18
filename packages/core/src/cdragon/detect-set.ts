import type { RawGameData, RawSetData } from "./types";

const MAIN_MUTATOR = /^TFTSet(\d+)$/;

export function mainSets(data: RawGameData): RawSetData[] {
  return data.setData
    .filter((set) => MAIN_MUTATOR.test(set.mutator))
    .sort((left, right) => left.number - right.number);
}

export function findMainSet(data: RawGameData, number: number): RawSetData {
  const set = mainSets(data).find((candidate) => candidate.number === number);
  if (!set) {
    throw new Error(`Set ${number} not found in CommunityDragon data`);
  }
  return set;
}

export function detectCurrentSet(data: RawGameData, override?: number | null): RawSetData {
  if (override != null) {
    return findMainSet(data, override);
  }
  const latest = mainSets(data).at(-1);
  if (!latest) {
    throw new Error("No main TFT set found in CommunityDragon data");
  }
  return latest;
}
