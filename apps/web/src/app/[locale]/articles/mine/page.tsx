import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ArticleCard } from "@/components/articles/article-card";
import { ViewerSync } from "@/components/auth/viewer-sync";
import { Pagination } from "@/components/comps/comps-shell";
import { currentLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { articlePath } from "@/lib/article-paths";
import { getAuthoredArticles } from "@/server/articles/queries";
import { getViewer } from "@/server/auth/viewer";
import { firstParam } from "@/server/comps/page-data";

type SearchParams = PageProps<"/[locale]/articles/mine">["searchParams"];

export async function generateMetadata() {
  const t = await getTranslations({ locale: await currentLocale(), namespace: "articles" });
  return { title: t("mine") };
}

export default function MyArticlesPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface/5" />}>
        <MyArticles searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function MyArticles({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const { page } = await searchParams;
  const [t, format, viewer] = await Promise.all([
    getTranslations("articles"),
    getFormatter(),
    getViewer(),
  ]);
  const header = (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-3xl font-bold text-primary">{t("mine")}</h1>
      <Link
        href={articlePath.create()}
        prefetch={false}
        className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary hover:bg-primary-hover"
      >
        {t("write")}
      </Link>
    </header>
  );
  if (!viewer) {
    return (
      <>
        <ViewerSync serverUserId={null} />
        {header}
        <p className="text-muted">
          {t("loginRequired")}{" "}
          <Link href="/login" className="text-primary hover:underline">
            {t("login")}
          </Link>
        </p>
      </>
    );
  }
  const result = await getAuthoredArticles(viewer.userId, Number(firstParam(page)) || 1);

  return (
    <>
      <ViewerSync serverUserId={viewer.userId} />
      {header}
      {result.rows.length === 0 ? (
        <p className="text-muted">{t("empty")}</p>
      ) : (
        <ul className="space-y-4">
          {result.rows.map((article) => (
            <li key={article.publicId}>
              <ArticleCard
                article={article}
                labels={{
                  category: t(`categories.${article.category}`),
                  status: t(`status.${article.status}`),
                  set: article.setId ? t("setLabel", { set: article.setId }) : undefined,
                  meta: format.dateTime(new Date(article.updatedAt), { dateStyle: "medium" }),
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={result.page}
        pages={result.pages}
        href={articlePath.mine}
        labels={{
          previous: t("previous"),
          next: t("next"),
          page: t("page", { page: result.page, pages: result.pages }),
        }}
      />
    </>
  );
}
