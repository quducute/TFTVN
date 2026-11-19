import { encodePlannerCode } from "@tftvn/core";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BookmarkButton } from "@/components/comps/bookmark-button";
import { CompActions } from "@/components/comps/comp-actions";
import { HexBoard } from "@/components/comps/hex-board";
import { PlannerCodeCopy } from "@/components/comps/planner-code-copy";
import { TierBadge } from "@/components/comps/tier-badge";
import { TraitList } from "@/components/comps/trait-list";
import { GameIcon } from "@/components/game-icon";
import { UnitIcon } from "@/components/riot/unit-icon";
import { currentLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { boardTraits, indexSetData } from "@/lib/comp-set";
import { compPath } from "@/lib/comp-paths";
import { getComp } from "@/server/comps/queries";
import { getCompSetData } from "@/server/comps/set-data";

type Params = PageProps<"/[locale]/comps/[publicId]">["params"];

export default function CompPage({ params }: Readonly<{ params: Params }>) {
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface/5" />}>
        <CompDetail params={params} />
      </Suspense>
    </main>
  );
}

async function CompDetail({ params }: Readonly<{ params: Params }>) {
  const { publicId } = await params;
  const comp = await getComp(publicId);
  if (!comp) {
    notFound();
  }
  const locale = await currentLocale();
  const [t, format, data] = await Promise.all([
    getTranslations("comps"),
    getFormatter(),
    getCompSetData(comp.setId, locale),
  ]);
  if (!data) {
    notFound();
  }
  const index = indexSetData(data);
  const units = [...comp.board].sort(
    (left, right) =>
      (index.champions.get(left.championApiName)?.cost ?? 0) -
      (index.champions.get(right.championApiName)?.cost ?? 0),
  );
  const plannerCodes = comp.board
    .map((unit) => index.champions.get(unit.championApiName)?.plannerCode)
    .filter((code): code is string => code != null);

  return (
    <>
      <nav className="text-sm">
        <Link href={compPath.list("meta")} className="text-muted hover:text-primary">
          {t("title")}
        </Link>
        <span className="text-muted"> / {t("setLabel", { set: comp.setId })}</span>
      </nav>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {comp.metaTier ? <TierBadge tier={comp.metaTier} className="size-12 text-2xl" /> : null}
          <div>
            <h1 className="text-3xl font-bold">{comp.name}</h1>
            <p className="text-sm text-muted">
              {t("by", { username: comp.ownerUsername })} -{" "}
              {t("updated", {
                time: format.dateTime(new Date(comp.updatedAt), { dateStyle: "medium" }),
              })}
              {comp.metaPatchId ? ` - ${t("patch", { patch: comp.metaPatchId })}` : null}
            </p>
            <p className="mt-1 flex flex-wrap gap-2 text-xs">
              {comp.difficulty ? (
                <span className="rounded-md border border-line/20 px-2 py-0.5">
                  {t("difficulty.label")}: {t(`difficulty.${comp.difficulty}`)}
                </span>
              ) : null}
              {comp.playstyle ? (
                <span className="rounded-md border border-line/20 px-2 py-0.5">
                  {t("playstyle.label")}: {t(`playstyle.${comp.playstyle}`)}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <BookmarkButton publicId={comp.publicId} />
          <CompActions publicId={comp.publicId} ownerId={comp.ownerId} metaTier={comp.metaTier} />
        </div>
      </header>

      <section aria-labelledby="comp-traits" className="space-y-2">
        <h2 id="comp-traits" className="text-xl font-semibold text-primary">
          {t("detail.traits")}
        </h2>
        <TraitList traits={boardTraits(comp.board, index)} index={index} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="comp-board">
          <h2 id="comp-board" className="text-xl font-semibold text-primary">
            {t("detail.board")}
          </h2>
          <HexBoard units={comp.board} index={index} label={t("detail.board")} />
        </section>
        <section aria-labelledby="comp-units" className="space-y-3">
          <h2 id="comp-units" className="text-xl font-semibold text-primary">
            {t("detail.units")}
          </h2>
          <ul className="space-y-2">
            {units.map((unit) => {
              const champion = index.champions.get(unit.championApiName);
              return (
                <li key={unit.hex} className="flex items-center gap-3">
                  <UnitIcon
                    champion={{
                      name: champion?.name ?? unit.championApiName,
                      icon: champion?.icon ?? null,
                      cost: champion?.cost ?? null,
                    }}
                    star={unit.starLevel}
                    items={[]}
                    size={40}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{champion?.name ?? unit.championApiName}</p>
                    <ul className="flex flex-wrap gap-1 text-xs text-muted">
                      {unit.items.map((item, position) => {
                        const info = index.items.get(item);
                        return (
                          <li key={`${item}-${position}`} className="flex items-center gap-1">
                            <GameIcon path={info?.icon} alt="" size={18} />
                            {info?.name ?? item}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {comp.augments.length > 0 ? (
        <section aria-labelledby="comp-augments" className="space-y-2">
          <h2 id="comp-augments" className="text-xl font-semibold text-primary">
            {t("detail.augments")}
          </h2>
          <ul className="flex flex-wrap gap-3">
            {comp.augments.map((apiName) => {
              const info = index.augments.get(apiName);
              return (
                <li
                  key={apiName}
                  className="flex items-center gap-2 rounded-lg border border-line/10 px-3 py-2"
                >
                  <GameIcon path={info?.icon} alt="" size={28} />
                  {info?.name ?? apiName}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {comp.description ? (
        <section aria-labelledby="comp-notes" className="space-y-2">
          <h2 id="comp-notes" className="text-xl font-semibold text-primary">
            {t("detail.description")}
          </h2>
          <p className="whitespace-pre-line text-text">{comp.description}</p>
        </section>
      ) : null}

      <PlannerCodeCopy
        code={plannerCodes.length > 0 ? encodePlannerCode(plannerCodes, data.mutator) : null}
      />
    </>
  );
}
