import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ViewerSync } from "@/components/auth/viewer-sync";
import { CompBuilder } from "@/components/comps/comp-builder";
import { currentLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/server/auth/viewer";
import { getComp } from "@/server/comps/queries";
import { getCompSetData } from "@/server/comps/set-data";

type Params = PageProps<"/[locale]/comps/[publicId]/edit">["params"];

export default function EditCompPage({ params }: Readonly<{ params: Params }>) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface/5" />}>
        <EditComp params={params} />
      </Suspense>
    </main>
  );
}

async function EditComp({ params }: Readonly<{ params: Params }>) {
  const { publicId } = await params;
  const [t, viewer, locale, comp] = await Promise.all([
    getTranslations("comps"),
    getViewer(),
    currentLocale(),
    getComp(publicId),
  ]);
  if (!comp) {
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
  if (viewer.userId !== comp.ownerId && viewer.role !== "admin") {
    return (
      <>
        <ViewerSync serverUserId={viewer.userId} />
        <p role="alert" className="text-danger">
          {t("errors.forbidden")}
        </p>
      </>
    );
  }
  const data = await getCompSetData(comp.setId, locale);
  if (!data) {
    notFound();
  }
  return (
    <>
      <ViewerSync serverUserId={viewer.userId} />
      <CompBuilder data={data} initial={comp} />
    </>
  );
}
