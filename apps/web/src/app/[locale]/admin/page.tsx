import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ReviewForm } from "@/components/admin/review-form";
import { currentLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { articlePath } from "@/lib/article-paths";
import { getArticlesByStatus } from "@/server/articles/queries";

export async function generateMetadata() {
  const t = await getTranslations({ locale: await currentLocale(), namespace: "admin" });
  return { title: t("title") };
}

export default function AdminReviewPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface/5" />}>
        <AdminShell tab="review">{() => <ReviewQueue />}</AdminShell>
      </Suspense>
    </main>
  );
}

async function ReviewQueue() {
  const [t, tArticles, format, queue] = await Promise.all([
    getTranslations("admin.review"),
    getTranslations("articles"),
    getFormatter(),
    getArticlesByStatus("queued", 1),
  ]);
  if (queue.rows.length === 0) {
    return <p className="text-muted">{t("empty")}</p>;
  }
  return (
    <ul className="space-y-4">
      {queue.rows.map((article) => (
        <li
          key={article.publicId}
          className="space-y-3 rounded-xl border border-line/10 bg-surface/5 p-5"
        >
          <div>
            <p className="text-xs text-muted">
              {tArticles(`categories.${article.category}`)} -{" "}
              {tArticles("by", { username: article.authorUsername })} -{" "}
              {format.dateTime(new Date(article.updatedAt), {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
            <h2 className="text-lg font-semibold">{article.title}</h2>
            <p className="mt-1 text-sm text-muted">{article.excerpt}</p>
            <Link
              href={articlePath.detail(article.publicId)}
              className="text-sm text-primary hover:underline"
            >
              {t("open")}
            </Link>
          </div>
          <ReviewForm publicId={article.publicId} />
        </li>
      ))}
    </ul>
  );
}
