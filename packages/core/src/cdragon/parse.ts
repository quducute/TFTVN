import {
  type FilledText,
  type LookupValue,
  renderDescription,
  renderTraitDescription,
} from "./description";
import { augmentTier, itemCategory } from "./classify";
import { findMainSet } from "./detect-set";
import type { HashResolver } from "./hash-resolver";
import { collectRoleApiNames } from "./roles";
import type {
  RawChampion,
  RawGameData,
  RawItem,
  RawSetData,
  RawTeamPlanner,
  RawTrait,
} from "./types";

export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export type GameEntityKind = "champion" | "trait" | "item" | "augment" | "role";

export interface LocalizedEntity {
  name: string;
  description: string;
  abilityName?: string;
  abilityDescription?: string;
}

export interface ParsedEntity {
  kind: GameEntityKind;
  apiName: string;
  i18n: Record<Locale, LocalizedEntity>;
  data: Record<string, unknown>;
  cost: number | null;
  traits: string[] | null;
  roleApiName: string | null;
  plannerCode: string | null;
}

export interface ParseReport {
  unresolvedHashes: number;
  missingPlaceholders: { kind: GameEntityKind; apiName: string; names: string[] }[];
}

export interface ParsedSet {
  number: number;
  mutator: string;
  name: string;
  entities: ParsedEntity[];
  report: ParseReport;
}

export interface ParseInput {
  sources: Record<Locale, RawGameData>;
  teamPlanner: RawTeamPlanner;
  setNumber: number;
  resolver: HashResolver;
}

function byLocale<T>(build: (locale: Locale) => T): Record<Locale, T> {
  return Object.fromEntries(LOCALES.map((locale) => [locale, build(locale)])) as Record<Locale, T>;
}

function indexBy<T extends { apiName: string }>(entries: readonly T[]): Map<string, T> {
  return new Map(entries.map((entry) => [entry.apiName, entry]));
}

export function plannerCodeToHex(code: number): string {
  return code.toString(16).padStart(3, "0");
}

export function parseSet({ sources, teamPlanner, setNumber, resolver }: ParseInput): ParsedSet {
  const sets: Record<Locale, RawSetData> = byLocale((locale) =>
    findMainSet(sources[locale], setNumber),
  );
  const primary = sets.vi;
  const items = byLocale((locale) => indexBy(sources[locale].items));
  const champions = byLocale((locale) => indexBy(sets[locale].champions));
  const traits = byLocale((locale) => indexBy(sets[locale].traits));
  const traitApiNameByName = new Map(primary.traits.map((trait) => [trait.name, trait.apiName]));
  const plannerCodes = new Map(
    (teamPlanner[primary.mutator] ?? []).map((entry) => [
      entry.character_id,
      entry.team_planner_code,
    ]),
  );

  const report: ParseReport = { unresolvedHashes: 0, missingPlaceholders: [] };
  const track = (kind: GameEntityKind, apiName: string, results: FilledText[]) => {
    const names = [...new Set(results.flatMap((result) => result.missing))];
    if (names.length > 0) {
      report.missingPlaceholders.push({ kind, apiName, names });
    }
  };

  const isPlayable = (champion: RawChampion) =>
    plannerCodes.size > 0
      ? plannerCodes.has(champion.apiName)
      : champion.cost >= 1 && champion.cost <= 5 && (champion.traits?.length ?? 0) > 0;

  const parseChampion = (champion: RawChampion): ParsedEntity => {
    const variables: Record<string, LookupValue> = Object.fromEntries(
      (champion.ability?.variables ?? []).map((variable) => [
        resolver.resolveKey(variable.name),
        variable.value ?? [],
      ]),
    );
    const filled: FilledText[] = [];
    const i18n = byLocale((locale): LocalizedEntity => {
      const localized = champions[locale].get(champion.apiName) ?? champion;
      const ability = renderDescription(localized.ability?.desc, variables);
      filled.push(ability);
      return {
        name: localized.name ?? champion.apiName,
        description: "",
        abilityName: localized.ability?.name ?? "",
        abilityDescription: ability.text,
      };
    });
    track("champion", champion.apiName, filled);
    const plannerCode = plannerCodes.get(champion.apiName);
    return {
      kind: "champion",
      apiName: champion.apiName,
      i18n,
      data: {
        stats: champion.stats ?? {},
        icon: champion.icon,
        squareIcon: champion.squareIcon,
        tileIcon: champion.tileIcon,
        ability: { icon: champion.ability?.icon ?? null, variables },
      },
      cost: champion.cost,
      traits: (champion.traits ?? []).map((name) => traitApiNameByName.get(name) ?? name),
      roleApiName: champion.role,
      plannerCode: plannerCode == null ? null : plannerCodeToHex(plannerCode),
    };
  };

  const parseTrait = (trait: RawTrait): ParsedEntity => {
    const effects = (trait.effects ?? []).map((effect) => ({
      minUnits: effect.minUnits,
      maxUnits: effect.maxUnits,
      style: effect.style,
      variables: resolver.resolveValues(effect.variables),
    }));
    report.unresolvedHashes += effects.reduce(
      (total, effect) => total + resolver.countUnresolved(effect.variables),
      0,
    );
    const filled: FilledText[] = [];
    const i18n = byLocale((locale): LocalizedEntity => {
      const localized = traits[locale].get(trait.apiName) ?? trait;
      const description = renderTraitDescription(
        localized.desc,
        localized.effects ?? [],
        (values) => resolver.resolveValues(values),
      );
      filled.push(description);
      return { name: localized.name ?? trait.apiName, description: description.text };
    });
    track("trait", trait.apiName, filled);
    return {
      kind: "trait",
      apiName: trait.apiName,
      i18n,
      data: { icon: trait.icon, effects },
      cost: null,
      traits: null,
      roleApiName: null,
      plannerCode: null,
    };
  };

  const parseItem = (kind: "item" | "augment", item: RawItem): ParsedEntity => {
    const effects = resolver.resolveValues(item.effects);
    report.unresolvedHashes += resolver.countUnresolved(effects);
    const filled: FilledText[] = [];
    const i18n = byLocale((locale): LocalizedEntity => {
      const localized = items[locale].get(item.apiName) ?? item;
      const description = renderDescription(localized.desc, effects);
      filled.push(description);
      return { name: localized.name ?? item.apiName, description: description.text };
    });
    track(kind, item.apiName, filled);
    return {
      kind,
      apiName: item.apiName,
      i18n,
      data: {
        icon: item.icon,
        effects,
        composition: item.composition ?? [],
        tags: item.tags ?? [],
        unique: item.unique ?? false,
        associatedTraits: item.associatedTraits ?? [],
        incompatibleTraits: item.incompatibleTraits ?? [],
        ...(kind === "item"
          ? {
              category: itemCategory({
                apiName: item.apiName,
                composition: item.composition ?? [],
                tags: item.tags ?? [],
              }),
            }
          : { tier: augmentTier(item.icon) }),
      },
      cost: null,
      traits: null,
      roleApiName: null,
      plannerCode: null,
    };
  };

  const resolveItems = (apiNames: readonly string[], augment: boolean) =>
    [...new Set(apiNames)]
      .map((apiName) => items.vi.get(apiName))
      .filter((item): item is RawItem => item != null && Boolean(item.isAugment) === augment);

  const playableChampions = primary.champions.filter(isPlayable);
  const roles = collectRoleApiNames(
    playableChampions.flatMap((champion) => (champion.role ? [champion.role] : [])),
  );

  const entities: ParsedEntity[] = [
    ...playableChampions.map(parseChampion),
    ...primary.traits.map(parseTrait),
    ...resolveItems(primary.items, false).map((item) => parseItem("item", item)),
    ...resolveItems(primary.augments, true).map((item) => parseItem("augment", item)),
    ...roles.map((role): ParsedEntity => ({
      kind: "role",
      apiName: role,
      i18n: byLocale(() => ({ name: role, description: "" })),
      data: {},
      cost: null,
      traits: null,
      roleApiName: null,
      plannerCode: null,
    })),
  ];

  return {
    number: primary.number,
    mutator: primary.mutator,
    name: primary.name,
    entities,
    report,
  };
}
