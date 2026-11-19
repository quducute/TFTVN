import * as rootParams from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { getMessagesFor } from "./messages";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale: explicitLocale }) => {
  const candidate = explicitLocale ?? (await rootParams.locale());
  const locale = hasLocale(routing.locales, candidate) ? candidate : routing.defaultLocale;
  return { locale, timeZone: "Asia/Ho_Chi_Minh", messages: getMessagesFor(locale) };
});
