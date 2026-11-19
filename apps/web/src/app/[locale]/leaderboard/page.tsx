import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { RiotErrorPanel } from "@/components/riot/riot-error";
import { currentLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { riotPath } from "@/lib/riot-paths";
import { getPlayerService } from "@/server/riot";
import { guardedLookup } from "@/server/riot/lookup-guard";

type SearchParams = PageProps<"/[locale]/leaderboard">["searchParams"];

export async function generateMetadata() {
  const t = await getTranslations({ locale: await currentLocale(), namespace: "leaderboard" });
  return { title: t("title") };
}

export default async function LeaderboardPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const t = await getTranslations({ locale: await currentLocale(), namespace: "leaderboard" });
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
      <p className="mt-2 mb-6 text-muted">{t("description")}</p>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface/5" />}>
        <Leaderboard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Leaderboard({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const { page: pageParam } = await searchParams;
  const requested = Number(Array.isArray(pageParam) ? pageParam[0] : pageParam) || 1;
  const [t, result] = await Promise.all([
    getTranslations("leaderboard"),
    guardedLookup("leaderboard", () => getPlayerService().leaderboard(requested)),
  ]);

  if (!result.ok) {
    return <RiotErrorPanel kind={result.kind} />;
  }
  const { page, pages, rows } = result.value;

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-line/10">
        <table className="w-full text-sm">
          <thead className="bg-surface/5 text-left text-muted">
            <tr>
              <th scope="col" className="px-3 py-2">
                {t("rank")}
              </th>
              <th scope="col" className="px-3 py-2">
                {t("player")}
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                {t("lp")}
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                {t("wins")}
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                {t("losses")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.puuid} className="border-t border-line/10">
                <td className="px-3 py-2 font-bold text-primary">{row.rank}</td>
                <td className="px-3 py-2">
                  {row.gameName && row.tagLine ? (
                    <Link
                      href={riotPath.player(row.gameName, row.tagLine)}
                      className="hover:text-primary"
                    >
                      {row.gameName}
                      <span className="text-muted">#{row.tagLine}</span>
                    </Link>
                  ) : (
                    <span className="text-muted">{t("unknownName")}</span>
                  )}
                  {row.hotStreak ? (
                    <span title={t("hotStreak")} className="ml-2 text-danger">
                      ^
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right font-semibold">{row.leaguePoints}</td>
                <td className="px-3 py-2 text-right">{row.wins}</td>
                <td className="px-3 py-2 text-right text-muted">{row.losses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav
        aria-label={t("page", { page, pages })}
        className="mt-4 flex items-center justify-between text-sm"
      >
        <PageLink page={page - 1} disabled={page <= 1} label={t("previous")} />
        <span className="text-muted">{t("page", { page, pages })}</span>
        <PageLink page={page + 1} disabled={page >= pages} label={t("next")} />
      </nav>
    </>
  );
}

function PageLink({
  page,
  disabled,
  label,
}: Readonly<{ page: number; disabled: boolean; label: string }>) {
  const className = "rounded-lg border border-line/20 px-3 py-1.5";
  if (disabled) {
    return (
      <span aria-disabled className={cn(className, "text-muted opacity-50")}>
        {label}
      </span>
    );
  }
  return (
    <Link
      href={riotPath.leaderboard(page)}
      className={cn(className, "hover:border-primary hover:text-primary")}
    >
      {label}
    </Link>
  );
}
