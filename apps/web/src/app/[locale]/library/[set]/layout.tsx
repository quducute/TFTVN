import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/locale";
import { type ReactNode, Suspense } from "react";
import { LibraryNav } from "@/components/library/library-nav";
import { SetSwitcher } from "@/components/library/set-switcher";
import { getLibrarySets } from "@/server/library";
import { resolveLibrarySet, setStaticParams } from "@/server/library-params";

export function generateStaticParams() {
  return setStaticParams();
}

export default function LibrarySetLayout({
  children,
  params,
}: LayoutProps<"/[locale]/library/[set]">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-surface/5" />}>
        <LibraryShell params={params}>{children}</LibraryShell>
      </Suspense>
    </main>
  );
}

async function LibraryShell({
  params,
  children,
}: {
  params: LayoutProps<"/[locale]/library/[set]">["params"];
  children: ReactNode;
}) {
  const { set: setParam } = await params;
  const locale = await currentLocale();
  const set = await resolveLibrarySet(setParam);
  const sets = await getLibrarySets();
  const t = await getTranslations({ locale, namespace: "library" });

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm tracking-wide text-muted uppercase">{t("title")}</p>
          <h1 className="text-3xl font-bold text-primary">{t("setLabel", { set: set.id })}</h1>
          <p className="text-sm text-muted">{t("patch", { patch: set.patch })}</p>
        </div>
        <SetSwitcher locale={locale} sets={sets} activeSet={set.id} />
      </header>
      <LibraryNav set={set.id} />
      <div className="mt-6">{children}</div>
    </>
  );
}
