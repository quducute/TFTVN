import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { libraryPath } from "@/lib/library-paths";
import type { LibrarySet } from "@/server/library";

interface SetSwitcherProps {
  locale: Locale;
  sets: LibrarySet[];
  activeSet: number;
}

export async function SetSwitcher({ locale, sets, activeSet }: SetSwitcherProps) {
  const t = await getTranslations({ locale, namespace: "library" });
  return (
    <div className="flex flex-wrap gap-2">
      {sets.map((set) => (
        <Link
          key={set.id}
          href={libraryPath.set(set.id)}
          className={cn(
            "rounded-full border px-3 py-1 text-sm",
            set.id === activeSet
              ? "border-primary bg-primary font-semibold text-on-primary"
              : "border-line/20 text-muted hover:border-primary hover:text-primary",
          )}
        >
          {t("setLabel", { set: set.id })}
          {set.isCurrent ? ` - ${t("currentSet")}` : ""}
        </Link>
      ))}
    </div>
  );
}
