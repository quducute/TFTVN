import type { ArticleStatus } from "@tftvn/core";
import { Link } from "@/i18n/navigation";
import { articlePath } from "@/lib/article-paths";
import { cn } from "@/lib/cn";
import type { ArticleSummary } from "@/server/articles/queries";

const STATUS_CLASS: Record<ArticleStatus, string> = {
  queued: "border-primary/60 text-primary",
  approved: "border-success/60 text-success",
  rejected: "border-danger/60 text-danger",
};

interface ArticleCardProps {
  article: ArticleSummary;
  labels: { category: string; meta: string; status?: string; set?: string };
}

export function ArticleCard({ article, labels }: ArticleCardProps) {
  return (
    <article className="rounded-xl border border-line/10 bg-surface/5 p-5 transition hover:border-primary">
      <p className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-md bg-primary px-2 py-0.5 font-semibold text-on-primary">
          {labels.category}
        </span>
        {labels.set ? (
          <span className="rounded-md border border-line/20 px-2 py-0.5">{labels.set}</span>
        ) : null}
        {labels.status ? (
          <span className={cn("rounded-md border px-2 py-0.5", STATUS_CLASS[article.status])}>
            {labels.status}
          </span>
        ) : null}
      </p>
      <h2 className="text-xl font-semibold">
        <Link href={articlePath.detail(article.publicId)} className="hover:text-primary">
          {article.title}
        </Link>
      </h2>
      <p className="mt-1 text-xs text-muted">{labels.meta}</p>
      <p className="mt-3 text-sm text-muted">{article.excerpt}</p>
      {article.tags.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2 text-xs">
          {article.tags.map((tag) => (
            <li key={tag}>
              <Link href={articlePath.list({ tag })} className="text-primary hover:underline">
                #{tag}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
