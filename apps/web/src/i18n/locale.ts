import { getLocale } from "next-intl/server";
import type { Locale } from "./routing";

export async function currentLocale(): Promise<Locale> {
  return (await getLocale()) as Locale;
}
