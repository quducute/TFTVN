import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ArticleEditorGate } from "@/components/articles/article-editor-gate";
import { currentLocale } from "@/i18n/locale";

export async function generateMetadata() {
  const t = await getTranslations({ locale: await currentLocale(), namespace: "articles.editor" });
  return { title: t("newTitle") };
}

export default function NewArticlePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface/5" />}>
        <ArticleEditorGate />
      </Suspense>
    </main>
  );
}
