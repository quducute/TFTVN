"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LanguageSwitcher() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams().toString();
  const href = search ? `${pathname}?${search}` : pathname;

  return (
    <div className="flex items-center gap-1" aria-label={t("language")}>
      {routing.locales.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => router.replace(href, { locale: option })}
          className={
            option === locale
              ? "rounded-md bg-primary px-2.5 py-1 text-sm font-semibold text-on-primary"
              : "rounded-md px-2.5 py-1 text-sm text-muted hover:text-primary"
          }
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
