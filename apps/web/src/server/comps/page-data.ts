import type { Locale } from "@/i18n/routing";
import { type IndexedSetData, indexSetData } from "@/lib/comp-set";
import { type LibrarySet, getLibrarySets } from "../library";
import { getCompSetData } from "./set-data";

export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function resolveCompSet(setParam: string | undefined): Promise<LibrarySet | null> {
  const sets = await getLibrarySets();
  const requested = setParam && /^\d+$/.test(setParam) ? Number(setParam) : null;
  return (
    sets.find((set) => set.id === requested) ?? sets.find((set) => set.isCurrent) ?? sets[0] ?? null
  );
}

export async function loadSetIndexes(
  setIds: Iterable<number>,
  locale: Locale,
): Promise<Map<number, IndexedSetData>> {
  const entries = await Promise.all(
    [...new Set(setIds)].map(async (setId) => {
      const data = await getCompSetData(setId, locale);
      return data ? ([setId, indexSetData(data)] as const) : null;
    }),
  );
  return new Map(entries.filter((entry) => entry != null));
}
