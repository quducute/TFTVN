import { hashedKey } from "./fnv";
import type { RawNumber, RawTraitEffect } from "./types";

const PLACEHOLDER = /@([A-Za-z_][\w.:]*)(?:\*(-?[\d.]+))?@/g;
const EXPAND_ROW = /<expandRow>([\s\S]*?)<\/expandRow>/g;
const ROW = /<row>([\s\S]*?)<\/row>/g;

export const UNKNOWN_VALUE = "?";

export type StarValues = readonly RawNumber[];
export type LookupValue = RawNumber | StarValues;
export type Lookup = (name: string) => LookupValue | undefined;

export interface FilledText {
  text: string;
  missing: string[];
}

export function createLookup(values: Record<string, LookupValue>): Lookup {
  const byName = new Map<string, LookupValue>();
  for (const [key, value] of Object.entries(values)) {
    byName.set(key.toLowerCase(), value);
  }
  return (name) => byName.get(name.toLowerCase()) ?? byName.get(hashedKey(name));
}

export function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function renderValue(value: LookupValue | undefined, factor: number): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "number") {
    return formatNumber(value * factor);
  }
  const levels = (value.length >= 4 ? value.slice(1, 4) : value).filter(
    (level): level is number => level != null,
  );
  if (levels.length === 0) {
    return null;
  }
  const rendered = levels.map((level) => formatNumber(level * factor));
  return new Set(rendered).size === 1 ? rendered[0]! : rendered.join("/");
}

export function fillPlaceholders(text: string, lookup: Lookup): FilledText {
  const missing: string[] = [];
  const filled = text.replace(PLACEHOLDER, (_match, name: string, multiplier?: string) => {
    if (name.includes(".") || name.includes(":")) {
      return UNKNOWN_VALUE;
    }
    const rendered = renderValue(lookup(name), multiplier ? Number(multiplier) : 1);
    if (rendered === null) {
      missing.push(name);
      return UNKNOWN_VALUE;
    }
    return rendered;
  });
  return { text: filled, missing };
}

export function renderDescription(
  text: string | null | undefined,
  values: Record<string, LookupValue>,
): FilledText {
  return text ? fillPlaceholders(text, createLookup(values)) : { text: "", missing: [] };
}

export function renderTraitDescription(
  text: string | null | undefined,
  effects: readonly RawTraitEffect[],
  resolve: (variables: RawTraitEffect["variables"]) => Record<string, RawNumber>,
): FilledText {
  if (!text) {
    return { text: "", missing: [] };
  }
  const missing = new Set<string>();
  const lookupFor = (effect: RawTraitEffect | undefined) =>
    createLookup(
      effect
        ? { ...resolve(effect.variables), MinUnits: effect.minUnits, MaxUnits: effect.maxUnits }
        : {},
    );
  const fill = (template: string, effect: RawTraitEffect | undefined) => {
    const result = fillPlaceholders(template, lookupFor(effect));
    result.missing.forEach((name) => missing.add(name));
    return result.text;
  };

  let rowIndex = 0;
  const expanded = text
    .replace(EXPAND_ROW, (_match, template: string) =>
      effects.map((effect) => `<row>${fill(template, effect)}</row>`).join("<br>"),
    )
    .replace(ROW, (_match, template: string) => {
      const effect = effects[Math.min(rowIndex, effects.length - 1)];
      rowIndex += 1;
      return `<row>${fill(template, effect)}</row>`;
    });

  return { text: fill(expanded, effects[0]), missing: [...missing] };
}
