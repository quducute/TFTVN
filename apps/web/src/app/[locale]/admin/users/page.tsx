import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { UserRoleSelect } from "@/components/admin/user-role-select";
import { Pagination } from "@/components/comps/comps-shell";
import { currentLocale } from "@/i18n/locale";
import { listUsers } from "@/server/admin/queries";
import type { AccessTokenClaims } from "@/server/auth/types";
import { firstParam } from "@/server/comps/page-data";

type SearchParams = PageProps<"/[locale]/admin/users">["searchParams"];

export async function generateMetadata() {
  const t = await getTranslations({ locale: await currentLocale(), namespace: "admin" });
  return { title: `${t("tabs.users")} - ${t("title")}` };
}

export default function AdminUsersPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface/5" />}>
        <AdminShell tab="users">
          {(viewer) => <Users viewer={viewer} searchParams={searchParams} />}
        </AdminShell>
      </Suspense>
    </main>
  );
}

async function Users({
  viewer,
  searchParams,
}: Readonly<{ viewer: AccessTokenClaims; searchParams: SearchParams }>) {
  const params = await searchParams;
  const query = firstParam(params.q) ?? "";
  const [t, format, result] = await Promise.all([
    getTranslations("admin.users"),
    getFormatter(),
    listUsers(query, Number(firstParam(params.page)) || 1),
  ]);
  const href = (page: number) => {
    const search = new URLSearchParams();
    if (query) {
      search.set("q", query);
    }
    if (page > 1) {
      search.set("page", String(page));
    }
    const text = search.toString();
    return text ? `/admin/users?${text}` : "/admin/users";
  };

  return (
    <>
      <form method="get" role="search" className="flex gap-2">
        <label htmlFor="admin-user-search" className="sr-only">
          {t("search")}
        </label>
        <input
          id="admin-user-search"
          type="search"
          name="q"
          defaultValue={query}
          placeholder={t("search")}
          className="min-w-0 flex-1 rounded-lg border border-line/20 bg-surface/5 px-3 py-2 outline-none focus:border-primary"
        />
        <button
          type="submit"
          className="rounded-lg border border-line/20 px-4 py-2 hover:border-primary hover:text-primary"
        >
          {t("searchButton")}
        </button>
      </form>
      {result.rows.length === 0 ? (
        <p className="text-muted">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line/10">
          <table className="w-full text-sm">
            <thead className="bg-surface/5 text-left text-muted">
              <tr>
                <th scope="col" className="px-3 py-2">
                  {t("username")}
                </th>
                <th scope="col" className="px-3 py-2">
                  {t("email")}
                </th>
                <th scope="col" className="px-3 py-2">
                  {t("joined")}
                </th>
                <th scope="col" className="px-3 py-2">
                  {t("role")}
                </th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((user) => (
                <tr key={user.id} className="border-t border-line/10">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {user.username}
                  </th>
                  <td className="px-3 py-2 text-muted">{user.email}</td>
                  <td className="px-3 py-2 text-muted">
                    {format.dateTime(new Date(user.createdAt), { dateStyle: "medium" })}
                  </td>
                  <td className="px-3 py-2">
                    <UserRoleSelect
                      userId={user.id}
                      username={user.username}
                      role={user.role}
                      isSelf={user.id === viewer.userId}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        page={result.page}
        pages={result.pages}
        href={href}
        labels={{
          previous: t("previous"),
          next: t("next"),
          page: t("page", { page: result.page, pages: result.pages }),
        }}
      />
    </>
  );
}
