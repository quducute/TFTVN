import type { ItemData } from "@tftvn/core";
import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/locale";
import { ItemCard } from "@/components/library/item-card";
import { cn } from "@/lib/cn";
import { getEntities, localized } from "@/server/library";
import { resolveLibrarySet } from "@/server/library-params";

const TIER_ORDER = ["3", "2", "1", "unknown"] as const;

const TIER_TEXT: Record<(typeof TIER_ORDER)[number], string> = {
  "3": "text-augment3",
  "2": "text-augment2",
  "1": "text-augment1",
  unknown: "text-muted",
};

export default async function AugmentsPage({
  params,
}: PageProps<"/[locale]/library/[set]/augments">) {
  const { set: setParam } = await params;
  const locale = await currentLocale();
  const set = await resolveLibrarySet(setParam);
  const [augments, t] = await Promise.all([
    getEntities<ItemData>(set.snapshotId, "augment"),
    getTranslations({ locale, namespace: "library.augments" }),
  ]);

  const sorted = [...augments].sort((left, right) =>
    localized(left, locale).name.localeCompare(localized(right, locale).name, locale),
  );
  const tierOf = (augment: (typeof augments)[number]) =>
    augment.data.tier == null ? "unknown" : String(augment.data.tier);

  return (
    <div className="space-y-10">
      {TIER_ORDER.map((tier) => {
        const list = sorted.filter((augment) => tierOf(augment) === tier);
        return list.length > 0 ? (
          <section key={tier}>
            <h2 className={cn("mb-3 text-lg font-semibold", TIER_TEXT[tier])}>
              {t(`tiers.${tier}`)}{" "}
              <span className="text-sm font-normal text-muted">({list.length})</span>
            </h2>
            <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {list.map((augment) => (
                <ItemCard key={augment.apiName} item={augment} locale={locale} />
              ))}
            </ul>
          </section>
        ) : null;
      })}
    </div>
  );
}
