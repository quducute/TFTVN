import { Suspense } from "react";
import type { ChampionData, TraitData } from "@tftvn/core";
import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/locale";
import { GameIcon } from "@/components/game-icon";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { COST_BORDER, COST_TEXT } from "@/lib/format";
import { libraryPath } from "@/lib/library-paths";
import { getEntities, localized } from "@/server/library";
import { resolveLibrarySet } from "@/server/library-params";

export default function ChampionsPage({ params }: PageProps<"/[locale]/library/[set]/champions">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface/5" />}>
      <ChampionsContent params={params} />
    </Suspense>
  );
}

async function ChampionsContent({
  params,
}: Pick<PageProps<"/[locale]/library/[set]/champions">, "params">) {
  const { set: setParam } = await params;
  const locale = await currentLocale();
  const set = await resolveLibrarySet(setParam);
  const [champions, traits, t] = await Promise.all([
    getEntities<ChampionData>(set.snapshotId, "champion"),
    getEntities<TraitData>(set.snapshotId, "trait"),
    getTranslations({ locale, namespace: "library.champions" }),
  ]);
  const traitInfo = new Map(
    traits.map((trait) => [
      trait.apiName,
      { name: localized(trait, locale).name, icon: trait.data.icon },
    ]),
  );
  const costs = [...new Set(champions.map((champion) => champion.cost ?? 0))].sort((a, b) => a - b);

  return (
    <div className="space-y-8">
      {costs.map((cost) => (
        <section key={cost}>
          <h2 className={cn("mb-3 text-lg font-semibold", COST_TEXT[cost] ?? "text-text")}>
            {t("cost", { cost })}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {champions
              .filter((champion) => (champion.cost ?? 0) === cost)
              .map((champion, position) => {
                const name = localized(champion, locale).name;
                return (
                  <li key={champion.apiName}>
                    <Link
                      href={libraryPath.champion(set.id, champion.apiName)}
                      className="flex h-full flex-col items-center gap-2 rounded-xl border border-line/10 bg-surface/5 p-3 text-center transition hover:border-primary"
                    >
                      <GameIcon
                        path={champion.data.squareIcon ?? champion.data.tileIcon}
                        alt={name}
                        size={64}
                        eager={cost === costs[0] && position < 12}
                        className={cn("border-2", COST_BORDER[cost] ?? "border-line/20")}
                      />
                      <span className="font-medium">{name}</span>
                      <ul className="flex flex-col items-start gap-1 text-xs text-muted">
                        {(champion.traits ?? []).map((apiName) => {
                          const trait = traitInfo.get(apiName);
                          return (
                            <li key={apiName} className="flex items-center gap-1">
                              <GameIcon
                                path={trait?.icon}
                                alt=""
                                size={16}
                                className="rounded-none"
                              />
                              {trait?.name ?? apiName}
                            </li>
                          );
                        })}
                      </ul>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
