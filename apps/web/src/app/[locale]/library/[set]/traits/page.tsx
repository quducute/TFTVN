import type { ChampionData, TraitData } from "@tftvn/core";
import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/locale";
import { GameIcon } from "@/components/game-icon";
import { GameText } from "@/components/game-text";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { COST_BORDER } from "@/lib/format";
import { libraryPath } from "@/lib/library-paths";
import { getEntities, localized } from "@/server/library";
import { resolveLibrarySet } from "@/server/library-params";

export default async function TraitsPage({ params }: PageProps<"/[locale]/library/[set]/traits">) {
  const { set: setParam } = await params;
  const locale = await currentLocale();
  const set = await resolveLibrarySet(setParam);
  const [traits, champions, t] = await Promise.all([
    getEntities<TraitData>(set.snapshotId, "trait"),
    getEntities<ChampionData>(set.snapshotId, "champion"),
    getTranslations({ locale, namespace: "library.traits" }),
  ]);

  const sorted = [...traits].sort((left, right) =>
    localized(left, locale).name.localeCompare(localized(right, locale).name, locale),
  );

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {sorted.map((trait) => {
        const text = localized(trait, locale);
        const members = champions.filter((champion) => champion.traits?.includes(trait.apiName));
        return (
          <li
            key={trait.apiName}
            id={trait.apiName}
            className="scroll-mt-24 rounded-xl border border-line/10 bg-surface/5 p-5 target:border-primary"
          >
            <div className="flex items-center gap-3">
              <GameIcon path={trait.data.icon} alt={text.name} size={36} />
              <h2 className="text-lg font-semibold text-primary">{text.name}</h2>
            </div>
            {trait.data.effects.length > 0 ? (
              <p className="mt-2 text-xs text-muted">
                {t("breakpoints")}:{" "}
                {trait.data.effects.map((effect) => effect.minUnits).join(" / ")}
              </p>
            ) : null}
            <GameText text={text.description} className="mt-3 text-sm" />
            {members.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-xs text-muted uppercase">{t("champions")}</p>
                <div className="flex flex-wrap gap-2">
                  {members.map((champion) => {
                    const name = localized(champion, locale).name;
                    return (
                      <Link
                        key={champion.apiName}
                        href={libraryPath.champion(set.id, champion.apiName)}
                        title={name}
                      >
                        <GameIcon
                          path={champion.data.squareIcon ?? champion.data.tileIcon}
                          alt={name}
                          size={40}
                          className={cn(
                            "border-2",
                            COST_BORDER[champion.cost ?? 0] ?? "border-line/20",
                          )}
                        />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
