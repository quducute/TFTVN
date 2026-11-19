import { Suspense } from "react";
import type { GameEntityKind } from "@tftvn/core";
import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { LIBRARY_SECTIONS, type LibrarySection, libraryPath } from "@/lib/library-paths";
import { getEntityCounts } from "@/server/library";
import { resolveLibrarySet } from "@/server/library-params";

const SECTION_KIND: Record<LibrarySection, GameEntityKind> = {
  champions: "champion",
  traits: "trait",
  items: "item",
  augments: "augment",
  roles: "role",
};

export default function LibraryHubPage({ params }: PageProps<"/[locale]/library/[set]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface/5" />}>
      <LibraryHubContent params={params} />
    </Suspense>
  );
}

async function LibraryHubContent({ params }: Pick<PageProps<"/[locale]/library/[set]">, "params">) {
  const { set: setParam } = await params;
  const locale = await currentLocale();
  const set = await resolveLibrarySet(setParam);
  const [counts, t] = await Promise.all([
    getEntityCounts(set.snapshotId),
    getTranslations({ locale, namespace: "library" }),
  ]);

  return (
    <section>
      <p className="text-muted">{t("hub.description", { set: set.id })}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LIBRARY_SECTIONS.map((section) => (
          <Link
            key={section}
            href={libraryPath.section(set.id, section)}
            className="rounded-xl border border-line/10 bg-surface/5 p-5 transition hover:border-primary"
          >
            <h2 className="text-lg font-semibold text-primary">{t(`sections.${section}`)}</h2>
            <p className="mt-1 text-sm text-muted">
              {t("hub.count", { count: counts[SECTION_KIND[section]] })}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
