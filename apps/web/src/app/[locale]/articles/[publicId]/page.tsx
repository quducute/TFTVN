import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ArticleActions } from "@/components/articles/article-actions";
import { ReactionBar } from "@/components/articles/reaction-bar";
import { ViewerSync } from "@/components/auth/viewer-sync";
import { CompCard } from "@/components/comps/comp-card";
import { CompGrid } from "@/components/comps/comps-shell";
import { currentLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { articlePath } from "@/lib/article-paths";
import { getArticle } from "@/server/articles/queries";
import { getViewer } from "@/server/auth/viewer";
import { loadSetIndexes } from "@/server/comps/page-data";
import { getComp } from "@/server/comps/queries";
import type { PublicComp } from "@/server/comps/types";

type Params = PageProps<"/[locale]/articles/[publicId]">["params"];

export default function ArticlePage({ params }: Readonly<{ params: Params }>) {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface/5" />}>
        <ArticleDetail params={params} />
      </Suspense>
    </main>
  );
}

async function ArticleDetail({ params }: Readonly<{ params: Params }>) {
  const { publicId } = await params;
  const article = await getArticle(publicId);
  if (!article) {
    notFound();
  }
  let viewerId: number | null | undefined;
  if (article.status !== "approved") {
    const viewer = await getViewer();
    if (!viewer || (viewer.userId !== article.authorId && viewer.role !== "admin")) {
      notFound();
    }
    viewerId = viewer.userId;
  }

  const locale = await currentLocale();
  const [t, format, comps] = await Promise.all([
    getTranslations("articles"),
    getFormatter(),
    Promise.all(article.compIds.map((id) => getComp(id))),
  ]);
  const linked = comps.filter((comp): comp is PublicComp => comp != null);
  const indexes = await loadSetIndexes(
    linked.map((comp) => comp.setId),
    locale,
  );
  const tCompBy = await getTranslations("comps");

  return (
    <>
      {viewerId === undefined ? null : <ViewerSync serverUserId={viewerId} />}
      <nav className="text-sm">
        <Link href={articlePath.list()} className="text-muted hover:text-primary">
          {t("title")}
        </Link>
        <span className="text-muted"> / </span>
        <Link
          href={articlePath.list({ category: article.category })}
          className="text-muted hover:text-primary"
        >
          {t(`categories.${article.category}`)}
        </Link>
      </nav>

      {article.status === "approved" ? null : (
        <p
          role="status"
          className={
            article.status === "rejected"
              ? "rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger"
              : "rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm"
          }
        >
          {article.status === "rejected"
            ? t("status.rejectedNote", { note: article.reviewNote ?? "" })
            : t("status.queuedNote")}
        </p>
      )}

      <header className="space-y-2">
        <h1 className="text-4xl font-bold">{article.title}</h1>
        <p className="text-sm text-muted">
          {t("by", { username: article.authorUsername })} -{" "}
          {format.dateTime(new Date(article.createdAt), { dateStyle: "long" })}
          {article.setId ? ` - ${t("setLabel", { set: article.setId })}` : null}
        </p>
        {article.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-sm">
            {article.tags.map((tag) => (
              <li key={tag}>
                <Link href={articlePath.list({ tag })} className="text-primary hover:underline">
                  #{tag}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <ArticleActions publicId={article.publicId} authorId={article.authorId} />
      </header>

      <div className="article-body" dangerouslySetInnerHTML={{ __html: article.body }} />

      {linked.length > 0 ? (
        <section aria-labelledby="article-comps" className="space-y-3">
          <h2 id="article-comps" className="text-xl font-semibold text-primary">
            {t("linkedComps")}
          </h2>
          <CompGrid>
            {linked.map((comp) => {
              const index = indexes.get(comp.setId);
              return index ? (
                <li key={comp.publicId}>
                  <CompCard
                    comp={comp}
                    index={index}
                    byLabel={tCompBy("by", { username: comp.ownerUsername })}
                  />
                </li>
              ) : null;
            })}
          </CompGrid>
        </section>
      ) : null}

      {article.status === "approved" ? <ReactionBar publicId={article.publicId} /> : null}
    </>
  );
}
