import { ITEM_CATEGORIES, type ItemData } from "@tftvn/core";
import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/locale";
import { ItemCard } from "@/components/library/item-card";
import { getEntities, localized } from "@/server/library";
import { resolveLibrarySet } from "@/server/library-params";

export default async function ItemsPage({ params }: PageProps<"/[locale]/library/[set]/items">) {
  const { set: setParam } = await params;
  const locale = await currentLocale();
  const set = await resolveLibrarySet(setParam);
  const [items, t] = await Promise.all([
    getEntities<ItemData>(set.snapshotId, "item"),
    getTranslations({ locale, namespace: "library.items" }),
  ]);

  const byApiName = new Map(items.map((item) => [item.apiName, item]));
  const sorted = [...items].sort((left, right) =>
    localized(left, locale).name.localeCompare(localized(right, locale).name, locale),
  );
  const inCategory = (category: string) =>
    sorted.filter((item) => (item.data.category ?? "other") === category);
  const others = inCategory("other");

  return (
    <div className="space-y-10">
      {ITEM_CATEGORIES.filter((category) => category !== "other").map((category) => {
        const list = inCategory(category);
        return list.length > 0 ? (
          <section key={category}>
            <h2 className="mb-3 text-lg font-semibold text-primary">
              {t(`categories.${category}`)}{" "}
              <span className="text-sm font-normal text-muted">({list.length})</span>
            </h2>
            <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {list.map((item) => (
                <ItemCard
                  key={item.apiName}
                  item={item}
                  locale={locale}
                  components={byApiName}
                  recipeLabel={t("recipe")}
                />
              ))}
            </ul>
          </section>
        ) : null;
      })}

      {others.length > 0 ? (
        <details className="rounded-xl border border-line/10 p-4">
          <summary className="cursor-pointer text-muted hover:text-primary">
            {t("showOther", { count: others.length })}
          </summary>
          <ul className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {others.map((item) => (
              <ItemCard key={item.apiName} item={item} locale={locale} compact />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
