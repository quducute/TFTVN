export const STAT_KEYS = [
  "hp",
  "mana",
  "damage",
  "attackSpeed",
  "armor",
  "magicResist",
  "critChance",
  "range",
] as const;

export type StatKey = (typeof STAT_KEYS)[number];

export const STAT_ICON: Record<StatKey, string> = {
  hp: "scaleHealth",
  mana: "scaleMana",
  damage: "scaleAD",
  attackSpeed: "scaleAS",
  armor: "scaleArmor",
  magicResist: "scaleMR",
  critChance: "scaleCrit",
  range: "scaleRange",
};

export function formatStatRow(
  key: StatKey,
  stats: Readonly<Record<string, number | null | undefined>>,
): string {
  if (key === "mana") {
    return `${formatStat("mana", stats.initialMana ?? 0)}/${formatStat("mana", stats.mana)}`;
  }
  return formatStat(key, stats[key]);
}

export function formatStat(key: StatKey, value: number | null | undefined): string {
  if (value == null) {
    return "-";
  }
  if (key === "attackSpeed") {
    return value.toFixed(2);
  }
  if (key === "critChance") {
    return `${Math.round(value * 100)}%`;
  }
  return String(Math.round(value));
}

export function formatStarValues(values: readonly (number | null)[]): string[] {
  const levels = values.length >= 4 ? values.slice(1, 4) : [...values];
  return levels.map((value) => (value == null ? "-" : String(Math.round(value * 100) / 100)));
}

export const COST_BORDER: Record<number, string> = {
  1: "border-cost1",
  2: "border-cost2",
  3: "border-cost3",
  4: "border-cost4",
  5: "border-cost5",
};

export const COST_TEXT: Record<number, string> = {
  1: "text-cost1",
  2: "text-cost2",
  3: "text-cost3",
  4: "text-cost4",
  5: "text-cost5",
};
