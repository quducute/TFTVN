import { getTranslations } from "next-intl/server";
import { ViewerSync } from "@/components/auth/viewer-sync";
import { currentLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { compPath } from "@/lib/comp-paths";
import { getViewer } from "@/server/auth/viewer";
import { loadSetIndexes } from "@/server/comps/page-data";
import { getBookmarkedComps, getOwnedComps } from "@/server/comps/queries";
import { CompCard } from "./comp-card";
import { CompGrid, CompsShell, Pagination } from "./comps-shell";

export async function UserCompList({
  kind,
  page,
}: Readonly<{ kind: "mine" | "bookmarks"; page: number }>) {
  const [t, viewer, locale] = await Promise.all([
    getTranslations("comps"),
    getViewer(),
    currentLocale(),
  ]);

  if (!viewer) {
    return (
      <CompsShell tab={kind}>
        <ViewerSync serverUserId={null} />
        <p className="text-muted">
          {t("loginRequired")}{" "}
          <Link href="/login" className="text-primary hover:underline">
            {t("login")}
          </Link>
        </p>
      </CompsShell>
    );
  }

  const result =
    kind === "mine"
      ? await getOwnedComps(viewer.userId, page)
      : await getBookmarkedComps(viewer.userId, page);
  const indexes = await loadSetIndexes(
    result.rows.map((comp) => comp.setId),
    locale,
  );

  return (
    <CompsShell tab={kind}>
      <ViewerSync serverUserId={viewer.userId} />
      {result.rows.length === 0 ? (
        <p className="text-muted">{t("empty")}</p>
      ) : (
        <CompGrid>
          {result.rows.map((comp) => {
            const index = indexes.get(comp.setId);
            return index ? (
              <li key={comp.publicId}>
                <CompCard
                  comp={comp}
                  index={index}
                  byLabel={`${t("setLabel", { set: comp.setId })} - ${t("by", { username: comp.ownerUsername })}`}
                />
              </li>
            ) : null;
          })}
        </CompGrid>
      )}
      <Pagination
        page={result.page}
        pages={result.pages}
        href={(target) => compPath.list(kind, { page: target })}
        labels={{
          previous: t("previous"),
          next: t("next"),
          page: t("page", { page: result.page, pages: result.pages }),
        }}
      />
    </CompsShell>
  );
}
