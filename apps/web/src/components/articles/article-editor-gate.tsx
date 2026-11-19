import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ViewerSync } from "@/components/auth/viewer-sync";
import { Link } from "@/i18n/navigation";
import { getArticle } from "@/server/articles/queries";
import { getViewer } from "@/server/auth/viewer";
import { getLibrarySets } from "@/server/library";
import { ArticleEditor } from "./article-editor";

export async function ArticleEditorGate({ publicId }: Readonly<{ publicId?: string }>) {
  const [t, viewer] = await Promise.all([getTranslations("articles"), getViewer()]);
  const [sets, article] = await Promise.all([
    getLibrarySets(),
    publicId ? getArticle(publicId) : Promise.resolve(undefined),
  ]);
  if (article === null) {
    notFound();
  }
  if (!viewer) {
    return (
      <>
        <ViewerSync serverUserId={null} />
        <p className="text-muted">
          {t("loginRequired")}{" "}
          <Link href="/login" className="text-primary hover:underline">
            {t("login")}
          </Link>
        </p>
      </>
    );
  }
  if (article && article.authorId !== viewer.userId && viewer.role !== "admin") {
    return (
      <>
        <ViewerSync serverUserId={viewer.userId} />
        <p role="alert" className="text-danger">
          {t("errors.forbidden")}
        </p>
      </>
    );
  }
  return (
    <>
      <ViewerSync serverUserId={viewer.userId} />
      <ArticleEditor sets={sets.map((set) => set.id)} initial={article} />
    </>
  );
}
