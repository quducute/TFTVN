import { notFound } from "next/navigation";
import { type LibrarySet, findLibrarySet, getEntities, getLibrarySets } from "./library";

export const PLACEHOLDER_PARAM = "__placeholder__";

export async function setStaticParams(): Promise<{ set: string }[]> {
  try {
    const sets = await getLibrarySets();
    if (sets.length > 0) {
      return sets.map((set) => ({ set: String(set.id) }));
    }
  } catch (error) {
    console.warn("Library sets are unavailable at build time", error);
  }
  return [{ set: PLACEHOLDER_PARAM }];
}

export async function championStaticParams(setParam: string): Promise<{ apiName: string }[]> {
  try {
    const set = setParam === PLACEHOLDER_PARAM ? null : await findLibrarySet(Number(setParam));
    if (set) {
      const champions = await getEntities(set.snapshotId, "champion");
      if (champions.length > 0) {
        return champions.map((champion) => ({ apiName: champion.apiName }));
      }
    }
  } catch (error) {
    console.warn("Library champions are unavailable at build time", error);
  }
  return [{ apiName: PLACEHOLDER_PARAM }];
}

export async function resolveLibrarySet(setParam: string): Promise<LibrarySet> {
  if (setParam === PLACEHOLDER_PARAM || !/^\d+$/.test(setParam)) {
    notFound();
  }
  const set = await findLibrarySet(Number(setParam));
  if (!set) {
    notFound();
  }
  return set;
}
