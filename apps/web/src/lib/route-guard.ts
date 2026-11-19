import { RANK_TIERS, STAT_SECTIONS } from "./stats-params";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const API_NAME = /^[A-Za-z0-9_]+$/;
const COMP_PAGES = new Set(["latest", "mine", "bookmarks", "new"]);
const ARTICLE_PAGES = new Set(["mine", "new"]);
const LIBRARY_SECTIONS = new Set(["champions", "traits", "items", "augments", "roles"]);

const includes = (list: readonly string[], value: string | undefined) =>
  value != null && list.includes(value);

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function isInvalidAppPath(pathname: string): boolean {
  const [section, first, second, third, ...rest] = pathname.split("/").filter(Boolean).map(decode);

  switch (section) {
    case "stats":
      return (
        first != null &&
        (!includes(RANK_TIERS, first) || !includes(STAT_SECTIONS, second) || third != null)
      );
    case "comps":
      return (
        first != null &&
        !COMP_PAGES.has(first) &&
        (!UUID.test(first) || (second != null && second !== "edit") || third != null)
      );
    case "articles":
      return (
        first != null &&
        !ARTICLE_PAGES.has(first) &&
        (!UUID.test(first) || (second != null && second !== "edit") || third != null)
      );
    case "library":
      if (first == null) {
        return false;
      }
      if (!/^\d+$/.test(first) || (second != null && !LIBRARY_SECTIONS.has(second))) {
        return true;
      }
      if (third != null) {
        return second !== "champions" || !API_NAME.test(third) || rest.length > 0;
      }
      return false;
    default:
      return false;
  }
}

export function localeOfPath(pathname: string, locales: readonly string[], fallback: string) {
  const first = pathname.split("/")[1] ?? "";
  return locales.includes(first) ? first : fallback;
}

export function stripLocale(pathname: string, locales: readonly string[]): string {
  const first = pathname.split("/")[1] ?? "";
  if (!locales.includes(first)) {
    return pathname;
  }
  return pathname.slice(first.length + 1) || "/";
}
