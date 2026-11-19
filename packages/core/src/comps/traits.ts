export interface TraitUnit {
  championApiName: string;
  traits: readonly string[];
  emblemTraits: readonly string[];
}

export interface TraitRule {
  breakpoints: readonly { minUnits: number; style: number }[];
}

export interface TraitCount {
  apiName: string;
  count: number;
  style: number;
  activeMinUnits: number | null;
  nextMinUnits: number | null;
}

export function countTraits(
  units: readonly TraitUnit[],
  rules: ReadonlyMap<string, TraitRule>,
): TraitCount[] {
  const holders = new Map<string, Set<string>>();
  const hold = (trait: string, holder: string) => {
    const set = holders.get(trait) ?? new Set<string>();
    set.add(holder);
    holders.set(trait, set);
  };

  units.forEach((unit, index) => {
    const native = new Set(unit.traits);
    for (const trait of native) {
      hold(trait, unit.championApiName);
    }
    for (const trait of new Set(unit.emblemTraits)) {
      if (!native.has(trait)) {
        hold(trait, `emblem:${index}`);
      }
    }
  });

  return [...holders]
    .map(([apiName, set]): TraitCount => {
      const count = set.size;
      const breakpoints = [...(rules.get(apiName)?.breakpoints ?? [])].sort(
        (left, right) => left.minUnits - right.minUnits,
      );
      const active = breakpoints.filter((breakpoint) => breakpoint.minUnits <= count).at(-1);
      const next = breakpoints.find((breakpoint) => breakpoint.minUnits > count);
      return {
        apiName,
        count,
        style: active?.style ?? 0,
        activeMinUnits: active?.minUnits ?? null,
        nextMinUnits: next?.minUnits ?? null,
      };
    })
    .sort(
      (left, right) =>
        right.style - left.style ||
        right.count - left.count ||
        left.apiName.localeCompare(right.apiName),
    );
}

const traitKey = (apiName: string) =>
  apiName
    .replace(/^(?:TFT\d*|DA)_(?:\d+_)?/, "")
    .replace(/\d+$/, "")
    .toLowerCase();

export function emblemTrait(itemApiName: string, traitApiNames: readonly string[]): string | null {
  if (!/Emblem/.test(itemApiName)) {
    return null;
  }
  const key = traitKey(itemApiName.replace(/Emblem(?:Item)?/, ""));
  return traitApiNames.find((trait) => traitKey(trait) === key) ?? null;
}
