"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { GameIcon } from "@/components/game-icon";
import { RoleIcon } from "@/components/role-icon";
import { useRouter } from "@/i18n/navigation";
import { api, toApiFailure } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { COST_BORDER } from "@/lib/format";
import type { AdminErrorCode } from "@/server/admin/service";

interface Option {
  apiName: string;
  name: string;
  icon: string | null;
}

export interface RoleEditorProps {
  setId: number;
  roles: { apiName: string; name: string }[];
  champions: (Option & { cost: number; gameRole: string | null; assignedRole: string | null })[];
  items: Option[];
  roleItems: Record<string, string[]>;
}

export function RoleEditor({ setId, roles, champions, items, roleItems }: RoleEditorProps) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const roleName = new Map(roles.map((role) => [role.apiName, role.name]));
  const itemByName = new Map(items.map((item) => [item.apiName, item]));

  const run = async (request: () => Promise<unknown>) => {
    setStatus(null);
    try {
      await request();
      setStatus({ tone: "success", text: t("roles.saved") });
      router.refresh();
    } catch (failure) {
      setStatus({
        tone: "error",
        text: t(`errors.${toApiFailure<AdminErrorCode>(failure).code}`),
      });
    }
  };

  const assign = (championApiName: string, role: string) =>
    run(() =>
      api.put(`/admin/sets/${setId}/champions/${encodeURIComponent(championApiName)}/role`, {
        role: role || null,
      }),
    );

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted">{t("roles.description")}</p>
      {status ? (
        <p
          role={status.tone === "error" ? "alert" : "status"}
          className={cn("text-sm", status.tone === "error" ? "text-danger" : "text-success")}
        >
          {status.text}
        </p>
      ) : null}

      <section aria-labelledby="admin-champion-roles" className="space-y-3">
        <h2 id="admin-champion-roles" className="text-xl font-semibold text-primary">
          {t("roles.champions")}
        </h2>
        <div className="overflow-x-auto rounded-xl border border-line/10">
          <table className="w-full text-sm">
            <thead className="bg-surface/5 text-left text-muted">
              <tr>
                <th scope="col" className="px-3 py-2">
                  {t("roles.champion")}
                </th>
                <th scope="col" className="px-3 py-2">
                  {t("roles.fromGame")}
                </th>
                <th scope="col" className="px-3 py-2">
                  {t("roles.assigned")}
                </th>
              </tr>
            </thead>
            <tbody>
              {champions.map((champion) => (
                <tr key={champion.apiName} className="border-t border-line/10">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    <span className="flex items-center gap-2">
                      <GameIcon
                        path={champion.icon}
                        alt=""
                        size={28}
                        className={cn("border", COST_BORDER[champion.cost] ?? "border-line/20")}
                      />
                      {champion.name}
                    </span>
                  </th>
                  <td className="px-3 py-2 text-muted">
                    {champion.gameRole
                      ? (roleName.get(champion.gameRole) ?? champion.gameRole)
                      : t("roles.none")}
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <RoleIcon
                        roleApiName={champion.assignedRole ?? champion.gameRole ?? ""}
                        label=""
                        size={20}
                      />
                      <select
                        aria-label={`${t("roles.assigned")}: ${champion.name}`}
                        value={champion.assignedRole ?? ""}
                        onChange={(event) => void assign(champion.apiName, event.target.value)}
                        className="rounded-lg border border-line/20 bg-bg px-2 py-1"
                      >
                        <option value="">{t("roles.useGame")}</option>
                        {roles.map((role) => (
                          <option key={role.apiName} value={role.apiName}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="admin-role-items" className="space-y-3">
        <h2 id="admin-role-items" className="text-xl font-semibold text-primary">
          {t("roles.roleItems")}
        </h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {roles.map((role) => (
            <li key={role.apiName}>
              <RoleItemsCard
                setId={setId}
                role={role}
                initial={roleItems[role.apiName] ?? []}
                items={items}
                itemByName={itemByName}
                run={run}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function RoleItemsCard({
  setId,
  role,
  initial,
  items,
  itemByName,
  run,
}: Readonly<{
  setId: number;
  role: { apiName: string; name: string };
  initial: string[];
  items: Option[];
  itemByName: Map<string, Option>;
  run: (request: () => Promise<unknown>) => Promise<void>;
}>) {
  const t = useTranslations("admin.roles");
  const [chosen, setChosen] = useState(initial);
  const [adding, setAdding] = useState("");

  return (
    <div className="space-y-3 rounded-xl border border-line/10 bg-surface/5 p-4">
      <h3 className="flex items-center gap-2 font-semibold">
        <RoleIcon roleApiName={role.apiName} label="" size={24} />
        {role.name}
      </h3>
      <ul className="flex min-h-9 flex-wrap gap-2">
        {chosen.map((apiName) => {
          const item = itemByName.get(apiName);
          const label = t("removeItem", { name: item?.name ?? apiName });
          return (
            <li key={apiName}>
              <button
                type="button"
                title={label}
                aria-label={label}
                onClick={() => setChosen((current) => current.filter((value) => value !== apiName))}
                className="block rounded-md border border-line/20 p-0.5 hover:border-danger"
              >
                <GameIcon path={item?.icon} alt="" size={32} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2">
        <select
          aria-label={`${t("addItem")}: ${role.name}`}
          value={adding}
          onChange={(event) => {
            const value = event.target.value;
            if (value && !chosen.includes(value)) {
              setChosen((current) => [...current, value]);
            }
            setAdding("");
          }}
          className="min-w-0 flex-1 rounded-lg border border-line/20 bg-bg px-2 py-1 text-sm"
        >
          <option value="">{t("addItem")}</option>
          {items
            .filter((item) => !chosen.includes(item.apiName))
            .map((item) => (
              <option key={item.apiName} value={item.apiName}>
                {item.name}
              </option>
            ))}
        </select>
        <button
          type="button"
          onClick={() =>
            void run(() =>
              api.put(`/admin/sets/${setId}/roles/${encodeURIComponent(role.apiName)}/items`, {
                items: chosen,
              }),
            )
          }
          className="rounded-lg bg-primary px-3 py-1 text-sm font-semibold text-on-primary hover:bg-primary-hover"
        >
          {t("save")}
        </button>
      </div>
    </div>
  );
}
