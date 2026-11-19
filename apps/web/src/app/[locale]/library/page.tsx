import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/locale";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { libraryPath } from "@/lib/library-paths";
import { getLibrarySets } from "@/server/library";

export default function LibraryIndexPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-surface/5" />}>
        <LibraryIndex />
      </Suspense>
    </main>
  );
}

async function LibraryIndex() {
  const locale = await currentLocale();
  await connection();
  const [sets, t] = await Promise.all([
    getLibrarySets(),
    getTranslations({ locale, namespace: "library" }),
  ]);

  return (
    <>
      <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
      {sets.length === 0 ? (
        <p className="mt-4 text-muted">{t("empty")}</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((set) => (
            <li key={set.id}>
              <Link
                href={libraryPath.set(set.id)}
                className="block rounded-xl border border-line/10 bg-surface/5 p-5 transition hover:border-primary"
              >
                <h2 className="text-xl font-semibold text-primary">
                  {t("setLabel", { set: set.id })}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {t("patch", { patch: set.patch })}
                  {set.isCurrent ? ` - ${t("currentSet")}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
