import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/locale";
import { Suspense } from "react";
import { ApiStatus } from "@/components/api-status";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { libraryPath } from "@/lib/library-paths";
import { getCurrentLibrarySet } from "@/server/library";
import { getDatabaseVersion } from "@/server/status";

export default async function HomePage() {
  const locale = await currentLocale();
  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-4xl font-bold text-primary sm:text-5xl">{t("heading")}</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">{t("tagline")}</p>
      <Link
        href={libraryPath.root()}
        className="mt-6 inline-block rounded-lg bg-primary px-5 py-2.5 font-semibold text-on-primary hover:bg-primary-hover"
      >
        {t("openLibrary")}
      </Link>

      <section className="mt-10 max-w-xl rounded-xl border border-line/10 bg-surface/5 p-6">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{t("status")}</h2>
        <Suspense fallback={<p className="mt-4 text-muted">{t("checking")}</p>}>
          <SystemStatus locale={locale} />
        </Suspense>
      </section>
    </main>
  );
}

async function SystemStatus({ locale }: { locale: Locale }) {
  await connection();
  const t = await getTranslations({ locale, namespace: "home" });
  const [version, currentSet] = await Promise.all([
    getDatabaseVersion().catch(() => null),
    getCurrentLibrarySet().catch(() => null),
  ]);

  const rows = [
    {
      label: t("database"),
      value: version ? (
        <span className="text-success">
          {t("ok")} - PostgreSQL {version}
        </span>
      ) : (
        <span className="text-danger">{t("error")}</span>
      ),
    },
    { label: t("api"), value: <ApiStatus /> },
    {
      label: t("currentSet"),
      value: currentSet ? (
        <span className="text-primary">
          Set {currentSet.id} - {currentSet.patch}
        </span>
      ) : (
        <span className="text-muted">{t("noSet")}</span>
      ),
    },
  ];

  return (
    <dl className="mt-4 divide-y divide-line/10">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between py-3">
          <dt>{row.label}</dt>
          <dd className="font-medium">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
