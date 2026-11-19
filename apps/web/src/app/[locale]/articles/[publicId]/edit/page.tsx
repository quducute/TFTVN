import { Suspense } from "react";
import { ArticleEditorGate } from "@/components/articles/article-editor-gate";

type Params = PageProps<"/[locale]/articles/[publicId]/edit">["params"];

export default function EditArticlePage({ params }: Readonly<{ params: Params }>) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface/5" />}>
        <EditArticle params={params} />
      </Suspense>
    </main>
  );
}

async function EditArticle({ params }: Readonly<{ params: Params }>) {
  const { publicId } = await params;
  return <ArticleEditorGate publicId={publicId} />;
}
