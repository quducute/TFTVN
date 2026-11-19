import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ViewerSync } from "@/components/auth/viewer-sync";
import { CompBuilder } from "@/components/comps/comp-builder";
import { currentLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/server/auth/viewer";
import { getCurrentLibrarySet } from "@/server/library";
import { getCompSetData } from "@/server/comps/set-data";

export async function generateMetadata() {
  const t = await getTranslations({ locale: await currentLocale(), namespace: "comps.builder" });
  return { title: t("newTitle") };
}

export default function NewCompPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface/5" />}>
        <NewComp />
      </Suspense>
    </main>
  );
}

async function NewComp() {
  const [t, viewer, locale] = await Promise.all([
    getTranslations("comps"),
    getViewer(),
    currentLocale(),
  ]);
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
  const set = await getCurrentLibrarySet();
  const data = set ? await getCompSetData(set.id, locale) : null;
  if (!data) {
    return <p className="text-muted">{t("empty")}</p>;
  }
  return (
    <>
      <ViewerSync serverUserId={viewer.userId} />
      <CompBuilder key={data.setId} data={data} />
    </>
  );
}
