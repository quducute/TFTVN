import { type ChampionData, UNKNOWN_VALUE, effectiveRole } from "@tftvn/core";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/locale";
import { GameIcon } from "@/components/game-icon";
import { GameText } from "@/components/game-text";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { COST_BORDER, COST_TEXT, STAT_KEYS, formatStarValues, formatStat } from "@/lib/format";
import { libraryPath } from "@/lib/library-paths";
import { getChampionRoleAssignments, getEntities, localized } from "@/server/library";
import { championStaticParams, resolveLibrarySet } from "@/server/library-params";

export async function generateStaticParams({
  params,
}: {
  params: { set: string };
}): Promise<{ apiName: string }[]> {
  return championStaticParams(params.set);
}

export default async function ChampionPage({
  params,
}: PageProps<"/[locale]/library/[set]/champions/[apiName]">) {
  const { set: setParam, apiName: rawApiName } = await params;
  const locale = await currentLocale();
  const set = await resolveLibrarySet(setParam);
  const apiName = decodeURIComponent(rawApiName);
  const [champions, traits, assignments, t, tStats, tRoles] = await Promise.all([
    getEntities<ChampionData>(set.snapshotId, "champion"),
    getEntities(set.snapshotId, "trait"),
    getChampionRoleAssignments(set.id),
    getTranslations({ locale, namespace: "library.champions" }),
    getTranslations({ locale, namespace: "library.stats" }),
    getTranslations({ locale, namespace: "library.roles.names" }),
  ]);

  const champion = champions.find((candidate) => candidate.apiName === apiName);
  if (!champion) {
    notFound();
  }
  const text = localized(champion, locale);
  const cost = champion.cost ?? 0;
  const role = effectiveRole(assignments[champion.apiName], champion.roleApiName);
  const traitsByApiName = new Map(traits.map((trait) => [trait.apiName, trait]));
  const variables = Object.entries(champion.data.ability.variables).filter(
    (entry): entry is [string, readonly (number | null)[]] => Array.isArray(entry[1]),
  );
  const abilityDescription = text.abilityDescription ?? "";

  return (
    <article className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <section className="space-y-4">
        <div className="flex items-center gap-4">
          <GameIcon
            path={champion.data.squareIcon ?? champion.data.tileIcon}
            alt={text.name}
            size={96}
            className={cn("border-2", COST_BORDER[cost] ?? "border-line/20")}
          />
          <div>
            <h2 className="text-2xl font-bold">{text.name}</h2>
            <p className={cn("text-sm font-semibold", COST_TEXT[cost] ?? "text-muted")}>
              {t("cost", { cost })}
            </p>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted uppercase">{t("traits")}</h3>
          <div className="flex flex-wrap gap-2">
            {(champion.traits ?? []).map((traitApiName) => {
              const trait = traitsByApiName.get(traitApiName);
              return (
                <Link
                  key={traitApiName}
                  href={libraryPath.trait(set.id, traitApiName)}
                  className="rounded-full border border-line/20 px-3 py-1 text-sm hover:border-primary hover:text-primary"
                >
                  {trait ? localized(trait, locale).name : traitApiName}
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted uppercase">{t("role")}</h3>
          <p>{role ? (tRoles.has(role) ? tRoles(role) : role) : t("noRole")}</p>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted uppercase">{t("stats")}</h3>
          <dl className="divide-y divide-line/10 rounded-xl border border-line/10 bg-surface/5">
            {STAT_KEYS.map((key) => (
              <div key={key} className="flex justify-between px-4 py-2 text-sm">
                <dt className="text-muted">{tStats(key)}</dt>
                <dd className="font-medium">{formatStat(key, champion.data.stats[key])}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="space-y-6">
        <div className="rounded-xl border border-line/10 bg-surface/5 p-5">
          <div className="flex items-center gap-3">
            <GameIcon path={champion.data.ability.icon} alt={text.abilityName ?? ""} size={40} />
            <div>
              <p className="text-xs text-muted uppercase">{t("ability")}</p>
              <h3 className="text-lg font-semibold text-primary">{text.abilityName}</h3>
            </div>
          </div>
          <GameText text={abilityDescription} className="mt-4" />
          {abilityDescription.includes(UNKNOWN_VALUE) ? (
            <p className="mt-3 text-xs text-muted">{t("unknownValue")}</p>
          ) : null}
        </div>

        {variables.length > 0 ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted uppercase">{t("variables")}</h3>
            <div className="overflow-x-auto rounded-xl border border-line/10">
              <table className="w-full text-sm">
                <thead className="bg-surface/5 text-muted">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium" />
                    {[1, 2, 3].map((star) => (
                      <th key={star} className="px-4 py-2 text-right font-medium">
                        {t("star", { star })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/10">
                  {variables.map(([name, values]) => (
                    <tr key={name}>
                      <td className="px-4 py-2 text-muted">{name}</td>
                      {formatStarValues(values).map((value, index) => (
                        <td key={index} className="px-4 py-2 text-right font-medium">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
    </article>
  );
}
