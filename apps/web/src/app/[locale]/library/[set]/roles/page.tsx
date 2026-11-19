import { type ChampionData, type ItemData, effectiveRole } from "@tftvn/core";
import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/locale";
import { GameIcon } from "@/components/game-icon";
import { RoleIcon } from "@/components/role-icon";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { COST_BORDER } from "@/lib/format";
import { libraryPath } from "@/lib/library-paths";
import {
  getChampionRoleAssignments,
  getEntities,
  getRoleItemMap,
  localized,
} from "@/server/library";
import { resolveLibrarySet } from "@/server/library-params";

export default async function RolesPage({ params }: PageProps<"/[locale]/library/[set]/roles">) {
  const { set: setParam } = await params;
  const locale = await currentLocale();
  const set = await resolveLibrarySet(setParam);
  const [roles, champions, items, assignments, roleItems, t] = await Promise.all([
    getEntities(set.snapshotId, "role"),
    getEntities<ChampionData>(set.snapshotId, "champion"),
    getEntities<ItemData>(set.snapshotId, "item"),
    getChampionRoleAssignments(set.id),
    getRoleItemMap(set.id),
    getTranslations({ locale, namespace: "library.roles" }),
  ]);
  const itemsByApiName = new Map(items.map((item) => [item.apiName, item]));
  const roleName = (apiName: string) =>
    t.has(`names.${apiName}`) ? t(`names.${apiName}`) : apiName;

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {roles.map((role) => {
        const members = champions.filter(
          (champion) =>
            effectiveRole(assignments[champion.apiName], champion.roleApiName) === role.apiName,
        );
        const recommended = (roleItems[role.apiName] ?? [])
          .map((apiName) => itemsByApiName.get(apiName))
          .filter((item) => item != null);
        return (
          <li key={role.apiName} className="rounded-xl border border-line/10 bg-surface/5 p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-primary">
              <RoleIcon roleApiName={role.apiName} label="" size={28} />
              {roleName(role.apiName)}
            </h2>
            <p className="text-xs text-muted">{role.apiName}</p>

            <p className="mt-4 mb-2 text-xs text-muted uppercase">{t("champions")}</p>
            {members.length > 0 ? (
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
            ) : (
              <p className="text-sm text-muted">{t("noChampions")}</p>
            )}

            <p className="mt-4 mb-2 text-xs text-muted uppercase">{t("recommendedItems")}</p>
            {recommended.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {recommended.map((item) => (
                  <GameIcon
                    key={item.apiName}
                    path={item.data.icon}
                    alt={localized(item, locale).name}
                    size={36}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">{t("noItems")}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
