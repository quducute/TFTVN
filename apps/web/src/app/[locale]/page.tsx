import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ApiStatus } from "@/components/api-status";
import { getCurrentSet, getDatabaseVersion } from "@/server/status";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await connection();

  const t = await getTranslations("home");
  const [version, currentSet] = await Promise.all([
    getDatabaseVersion().catch(() => null),
    getCurrentSet().catch(() => null),
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
          Set {currentSet.id} - {currentSet.name}
        </span>
      ) : (
        <span className="text-muted">{t("noSet")}</span>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-4xl font-bold text-primary sm:text-5xl">{t("heading")}</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">{t("tagline")}</p>

      <section className="mt-10 max-w-xl rounded-xl border border-line/10 bg-surface/5 p-6">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{t("status")}</h2>
        <dl className="mt-4 divide-y divide-line/10">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between py-3">
              <dt>{row.label}</dt>
              <dd className="font-medium">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
