import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CompCard } from "@/components/comps/comp-card";
import { CompGrid, CompsShell, Pagination } from "@/components/comps/comps-shell";
import { currentLocale } from "@/i18n/locale";
import { compPath } from "@/lib/comp-paths";
import { getCurrentLibrarySet } from "@/server/library";
import { firstParam, loadSetIndexes } from "@/server/comps/page-data";
import { getLatestComps } from "@/server/comps/queries";

type SearchParams = PageProps<"/[locale]/comps/latest">["searchParams"];

export async function generateMetadata() {
  const t = await getTranslations({ locale: await currentLocale(), namespace: "comps" });
  return { title: `${t("tabs.latest")} - ${t("title")}` };
}

export default function LatestCompsPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-6xl animate-pulse bg-surface/5" />}>
      <LatestComps searchParams={searchParams} />
    </Suspense>
  );
}

async function LatestComps({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const locale = await currentLocale();
  const [t, set] = await Promise.all([getTranslations("comps"), getCurrentLibrarySet()]);
  if (!set) {
    return (
      <CompsShell tab="latest">
        <p className="text-muted">{t("empty")}</p>
      </CompsShell>
    );
  }
  const champion = firstParam(params.champion) || null;
  const [result, indexes] = await Promise.all([
    getLatestComps(set.id, Number(firstParam(params.page)) || 1, champion),
    loadSetIndexes([set.id], locale),
  ]);
  const index = indexes.get(set.id);
  const champions = index
    ? [...index.champions.values()].sort((left, right) =>
        left.name.localeCompare(right.name, locale),
      )
    : [];

  return (
    <CompsShell tab="latest" setId={set.id}>
      <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-muted">{t("filterChampion")}</span>
          <select
            name="champion"
            defaultValue={champion ?? ""}
            className="rounded-lg border border-line/20 bg-bg px-3 py-2"
          >
            <option value="">{t("allChampions")}</option>
            {champions.map((entry) => (
              <option key={entry.apiName} value={entry.apiName}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg border border-line/20 px-3 py-2 hover:border-primary hover:text-primary"
        >
          {t("filterChampion")}
        </button>
      </form>
      {result.rows.length === 0 || !index ? (
        <p className="text-muted">{t("empty")}</p>
      ) : (
        <CompGrid>
          {result.rows.map((comp) => (
            <li key={comp.publicId}>
              <CompCard
                comp={comp}
                index={index}
                byLabel={t("by", { username: comp.ownerUsername })}
              />
            </li>
          ))}
        </CompGrid>
      )}
      <Pagination
        page={result.page}
        pages={result.pages}
        href={(page) => compPath.list("latest", { page, champion })}
        labels={{
          previous: t("previous"),
          next: t("next"),
          page: t("page", { page: result.page, pages: result.pages }),
        }}
      />
    </CompsShell>
  );
}
