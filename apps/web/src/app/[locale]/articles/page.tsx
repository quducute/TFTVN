import { ARTICLE_CATEGORIES, type ArticleCategory } from "@tftvn/core";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ArticleCard } from "@/components/articles/article-card";
import { Pagination } from "@/components/comps/comps-shell";
import { currentLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { articlePath } from "@/lib/article-paths";
import { cn } from "@/lib/cn";
import { getApprovedArticles } from "@/server/articles/queries";
import { firstParam } from "@/server/comps/page-data";

type SearchParams = PageProps<"/[locale]/articles">["searchParams"];

export async function generateMetadata() {
  const t = await getTranslations({ locale: await currentLocale(), namespace: "articles" });
  return { title: t("title"), description: t("description") };
}

export default async function ArticlesPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const t = await getTranslations({ locale: await currentLocale(), namespace: "articles" });
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
          <p className="mt-1 text-muted">{t("description")}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={articlePath.mine()}
            className="rounded-lg border border-line/20 px-4 py-2 hover:border-primary hover:text-primary"
          >
            {t("mine")}
          </Link>
          <Link
            href={articlePath.create()}
            prefetch={false}
            className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary hover:bg-primary-hover"
          >
            {t("write")}
          </Link>
        </div>
      </header>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface/5" />}>
        <ArticleList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ArticleList({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const categoryParam = firstParam(params.category);
  const category = (ARTICLE_CATEGORIES as readonly string[]).includes(categoryParam ?? "")
    ? (categoryParam as ArticleCategory)
    : null;
  const tag = firstParam(params.tag)?.trim().toLowerCase() || null;
  const [t, format, result] = await Promise.all([
    getTranslations("articles"),
    getFormatter(),
    getApprovedArticles({ category, tag, page: Number(firstParam(params.page)) || 1 }),
  ]);

  return (
    <>
      <nav>
        <ul className="flex flex-wrap gap-1 rounded-lg border border-line/10 p-1 text-sm">
          {[null, ...ARTICLE_CATEGORIES].map((value) => (
            <li key={value ?? "all"}>
              <Link
                href={articlePath.list({ category: value, tag })}
                aria-current={value === category ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-1.5",
                  value === category
                    ? "bg-primary font-semibold text-on-primary"
                    : "text-muted hover:text-primary",
                )}
              >
                {value ? t(`categories.${value}`) : t("all")}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {tag ? (
        <p className="text-sm">
          {t("filteredByTag", { tag })}{" "}
          <Link href={articlePath.list({ category })} className="text-primary hover:underline">
            {t("clearFilter")}
          </Link>
        </p>
      ) : null}
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
                  set: article.setId ? t("setLabel", { set: article.setId }) : undefined,
                  meta: `${t("by", { username: article.authorUsername })} - ${format.dateTime(
                    new Date(article.createdAt),
                    { dateStyle: "medium" },
                  )}`,
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={result.page}
        pages={result.pages}
        href={(page) => articlePath.list({ category, tag, page })}
        labels={{
          previous: t("previous"),
          next: t("next"),
          page: t("page", { page: result.page, pages: result.pages }),
        }}
      />
    </>
  );
}
