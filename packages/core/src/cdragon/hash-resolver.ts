import { HASHED_KEY_PATTERN, fnv1a32 } from "./fnv";
import type { RawGameData, RawValues } from "./types";

const PLACEHOLDER_NAME = /@([A-Za-z_][A-Za-z0-9_]*)/g;

export function collectVocabulary(sources: RawGameData[]): Set<string> {
  const vocabulary = new Set<string>();
  const addText = (text: string | null | undefined) => {
    for (const match of (text ?? "").matchAll(PLACEHOLDER_NAME)) {
      vocabulary.add(match[1]!);
    }
  };
  const addKeys = (values: RawValues | null | undefined) => {
    for (const key of Object.keys(values ?? {})) {
      if (!HASHED_KEY_PATTERN.test(key)) {
        vocabulary.add(key);
      }
    }
  };

  for (const data of sources) {
    for (const item of data.items) {
      addText(item.desc);
      addKeys(item.effects);
    }
    for (const set of data.setData) {
      for (const trait of set.traits) {
        addText(trait.desc);
        for (const effect of trait.effects ?? []) {
          addKeys(effect.variables);
        }
      }
      for (const champion of set.champions) {
        addText(champion.ability?.desc);
        for (const variable of champion.ability?.variables ?? []) {
          vocabulary.add(variable.name);
        }
      }
    }
  }
  return vocabulary;
}

export class HashResolver {
  private readonly names = new Map<string, string>();

  constructor(vocabulary: Iterable<string>, overrides: Record<string, string> = {}) {
    for (const name of vocabulary) {
      this.names.set(fnv1a32(name), name);
    }
    for (const [hash, name] of Object.entries(overrides)) {
      this.names.set(hash.replace(/[{}]/g, "").toLowerCase(), name);
    }
  }

  resolveKey(key: string): string {
    const match = HASHED_KEY_PATTERN.exec(key);
    return match ? (this.names.get(match[1]!) ?? key) : key;
  }

  resolveValues(values: RawValues | null | undefined): RawValues {
    return Object.fromEntries(
      Object.entries(values ?? {}).map(([key, value]) => [this.resolveKey(key), value]),
    );
  }

  countUnresolved(values: RawValues | null | undefined): number {
    return Object.keys(this.resolveValues(values)).filter((key) => HASHED_KEY_PATTERN.test(key))
      .length;
  }
}
