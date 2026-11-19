import { META_TIERS } from "@tftvn/core";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CompCard } from "@/components/comps/comp-card";
import { CompGrid, CompsShell } from "@/components/comps/comps-shell";
import { TierBadge } from "@/components/comps/tier-badge";
import { currentLocale } from "@/i18n/locale";
import { getCurrentLibrarySet } from "@/server/library";
import { loadSetIndexes } from "@/server/comps/page-data";
import { getMetaComps } from "@/server/comps/queries";

export async function generateMetadata() {
  const t = await getTranslations({ locale: await currentLocale(), namespace: "comps" });
  return { title: t("title"), description: t("description") };
}

export default function MetaCompsPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-6xl animate-pulse bg-surface/5" />}>
      <MetaComps />
    </Suspense>
  );
}

async function MetaComps() {
  const locale = await currentLocale();
  await connection();
  const [t, set] = await Promise.all([getTranslations("comps"), getCurrentLibrarySet()]);
  if (!set) {
    return (
      <CompsShell tab="meta">
        <p className="text-muted">{t("metaEmpty")}</p>
      </CompsShell>
    );
  }
  const [comps, indexes] = await Promise.all([
    getMetaComps(set.id),
    loadSetIndexes([set.id], locale),
  ]);
  const index = indexes.get(set.id);

  return (
    <CompsShell tab="meta" setId={set.id}>
      {comps.length === 0 || !index ? (
        <p className="text-muted">{t("metaEmpty")}</p>
      ) : (
        META_TIERS.map((tier) => {
          const tierComps = comps.filter((comp) => comp.metaTier === tier);
          if (tierComps.length === 0) {
            return null;
          }
          return (
            <section key={tier} aria-label={t("tier", { tier })} className="flex gap-4">
              <TierBadge tier={tier} className="size-12 text-2xl" />
              <div className="flex-1">
                <CompGrid>
                  {tierComps.map((comp) => (
                    <li key={comp.publicId}>
                      <CompCard
                        comp={comp}
                        index={index}
                        byLabel={t("by", { username: comp.ownerUsername })}
                      />
                    </li>
                  ))}
                </CompGrid>
              </div>
            </section>
          );
        })
      )}
    </CompsShell>
  );
}
