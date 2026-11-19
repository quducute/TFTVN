import en from "../../messages/en.json" with { type: "json" };
import vi from "../../messages/vi.json" with { type: "json" };
import type { Locale } from "./routing";

type Messages = { [key: string]: string | Messages };

function withFallback(primary: Messages, fallback: Messages): Messages {
  const result: Messages = { ...fallback };
  for (const [key, value] of Object.entries(primary)) {
    const base = fallback[key];
    result[key] =
      typeof value === "object" && typeof base === "object" ? withFallback(value, base) : value;
  }
  return result;
}

export function flattenKeys(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "object" ? flattenKeys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

export const catalogs: Record<Locale, Messages> = { vi, en };

export function getMessagesFor(locale: Locale): Messages {
  return locale === "vi" ? vi : withFallback(en, vi);
}
