import type { ChampionData, ItemData } from "@tftvn/core";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { RoleEditor } from "@/components/admin/role-editor";
import { currentLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { isCompItem } from "@/server/comps/catalog";
import { firstParam, resolveCompSet } from "@/server/comps/page-data";
import {
  getChampionRoleAssignments,
  getEntities,
  getLibrarySets,
  getRoleItemMap,
  localized,
} from "@/server/library";

type SearchParams = PageProps<"/[locale]/admin/roles">["searchParams"];

export async function generateMetadata() {
  const t = await getTranslations({ locale: await currentLocale(), namespace: "admin" });
  return { title: `${t("tabs.roles")} - ${t("title")}` };
}

export default function AdminRolesPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface/5" />}>
        <AdminShell tab="roles">{() => <Roles searchParams={searchParams} />}</AdminShell>
      </Suspense>
    </main>
  );
}

async function Roles({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const { set: setParam } = await searchParams;
  const locale = await currentLocale();
  const [t, tRoles, sets, set] = await Promise.all([
    getTranslations("admin.roles"),
    getTranslations("library.roles"),
    getLibrarySets(),
    resolveCompSet(firstParam(setParam)),
  ]);
  if (!set) {
    return null;
  }
  const [roles, champions, items, assignments, roleItems] = await Promise.all([
    getEntities(set.snapshotId, "role"),
    getEntities<ChampionData>(set.snapshotId, "champion"),
    getEntities<ItemData>(set.snapshotId, "item"),
    getChampionRoleAssignments(set.id),
    getRoleItemMap(set.id),
  ]);
  const roleName = (apiName: string) =>
    tRoles.has(`names.${apiName}`) ? tRoles(`names.${apiName}`) : apiName;

  return (
    <>
      <ul className="flex gap-1 text-sm">
        {sets.map((entry) => (
          <li key={entry.id}>
            <Link
              href={`/admin/roles?set=${entry.id}`}
              aria-current={entry.id === set.id ? "page" : undefined}
              className={cn(
                "block rounded-md border px-3 py-1.5",
                entry.id === set.id
                  ? "border-primary text-primary"
                  : "border-line/10 text-muted hover:text-primary",
              )}
            >
              {t("setLabel", { set: entry.id })}
            </Link>
          </li>
        ))}
      </ul>
      <RoleEditor
        key={set.id}
        setId={set.id}
        roles={roles.map((role) => ({ apiName: role.apiName, name: roleName(role.apiName) }))}
        champions={champions.map((champion) => ({
          apiName: champion.apiName,
          name: localized(champion, locale).name,
          icon: champion.data.squareIcon ?? champion.data.tileIcon,
          cost: champion.cost ?? 0,
          gameRole: champion.roleApiName,
          assignedRole: assignments[champion.apiName] ?? null,
        }))}
        items={items
          .filter((item) => isCompItem(item.data))
          .map((item) => ({
            apiName: item.apiName,
            name: localized(item, locale).name,
            icon: item.data.icon,
          }))
          .sort((left, right) => left.name.localeCompare(right.name, locale))}
        roleItems={roleItems}
      />
    </>
  );
}
