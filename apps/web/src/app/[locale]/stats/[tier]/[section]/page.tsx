import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { type StatsTableRow, StatsTable } from "@/components/stats/stats-table";
import { currentLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { riotPath } from "@/lib/riot-paths";
import { type GameLookup, getGameLookup } from "@/server/game-lookup";
import { getCurrentLibrarySet } from "@/server/library";
import {
  RANK_TIERS,
  type RankTier,
  STAT_SECTIONS,
  type StatSection,
  getLastStatsSync,
  getStatsTable,
} from "@/server/stats";

const SMALL_SAMPLE_MATCHES = 100;

type Params = PageProps<"/[locale]/stats/[tier]/[section]">["params"];

export function generateStaticParams() {
  return RANK_TIERS.flatMap((tier) => STAT_SECTIONS.map((section) => ({ tier, section })));
}

const isTier = (value: string): value is RankTier =>
  (RANK_TIERS as readonly string[]).includes(value);
const isSection = (value: string): value is StatSection =>
  (STAT_SECTIONS as readonly string[]).includes(value);

export async function generateMetadata({ params }: Readonly<{ params: Params }>) {
  const { tier, section } = await params;
  const t = await getTranslations({ locale: await currentLocale(), namespace: "stats" });
  if (!isTier(tier) || !isSection(section)) {
    return { title: t("title") };
  }
  return { title: `${t(`sections.${section}`)} - ${t(`tiers.${tier}`)}` };
}

export default async function StatsPage({ params }: Readonly<{ params: Params }>) {
  const { tier, section } = await params;
  if (!isTier(tier) || !isSection(section)) {
    notFound();
  }
  const t = await getTranslations({ locale: await currentLocale(), namespace: "stats" });

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
      <nav className="flex flex-wrap gap-6">
        <Tabs
          items={RANK_TIERS.map((value) => ({
            href: riotPath.stats(value, section),
            label: t(`tiers.${value}`),
            active: value === tier,
          }))}
        />
        <Tabs
          items={STAT_SECTIONS.map((value) => ({
            href: riotPath.stats(tier, value),
            label: t(`sections.${value}`),
            active: value === section,
          }))}
        />
      </nav>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface/5" />}>
        <StatsContent tier={tier} section={section} />
      </Suspense>
    </main>
  );
}

function Tabs({ items }: Readonly<{ items: { href: string; label: string; active: boolean }[] }>) {
  return (
    <ul className="flex gap-1 rounded-lg border border-line/10 p-1 text-sm">
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "block rounded-md px-3 py-1.5",
              item.active
                ? "bg-primary font-semibold text-on-primary"
                : "text-muted hover:text-primary",
            )}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function variantInfo(section: StatSection, key: string, lookup: GameLookup, levelLabel: string) {
  if (section === "champions") {
    const item = lookup.item(key);
    return { label: item.name, icon: item.icon };
  }
  if (section === "items") {
    const champion = lookup.champion(key);
    return { label: champion.name, icon: champion.icon };
  }
  return { label: levelLabel, icon: null };
}

async function StatsContent({ tier, section }: Readonly<{ tier: RankTier; section: StatSection }>) {
  const locale = await currentLocale();
  await connection();
  const [t, format, set] = await Promise.all([
    getTranslations("stats"),
    getFormatter(),
    getCurrentLibrarySet(),
  ]);
  if (!set) {
    return <p className="text-muted">{t("noData")}</p>;
  }
  const [table, lookup, lastSync] = await Promise.all([
    getStatsTable(set.id, tier, section),
    getGameLookup(set.id, locale),
    getLastStatsSync(),
  ]);
  if (table.rows.length === 0) {
    return <p className="text-muted">{t("noData")}</p>;
  }

  const entity = (apiName: string) =>
    section === "champions"
      ? lookup.champion(apiName)
      : section === "traits"
        ? lookup.trait(apiName)
        : lookup.item(apiName);

  const rows: StatsTableRow[] = table.rows.map((row) => {
    const info = entity(row.apiName);
    return {
      apiName: row.apiName,
      name: info.name,
      icon: info.icon,
      cost: section === "champions" ? info.cost : null,
      games: row.games,
      pickRate: row.pickRate,
      averagePlacement: row.averagePlacement,
      top4Rate: row.top4Rate,
      top1Rate: row.top1Rate,
      variants: row.variants.map((variant) => ({
        key: variant.key,
        games: variant.games,
        averagePlacement: variant.averagePlacement,
        ...variantInfo(section, variant.key, lookup, t("variantLevel", { level: variant.key })),
      })),
    };
  });
  const syncedAt = lastSync ? new Date(lastSync) : null;

  return (
    <section className="space-y-3">
      <p className="text-sm text-muted">
        {t("description", { matches: table.matchCount, tier: t(`tiers.${tier}`) })}
        {syncedAt && !Number.isNaN(syncedAt.getTime())
          ? ` ${t("updated", { time: format.dateTime(syncedAt, { dateStyle: "short", timeStyle: "short" }) })}`
          : null}
      </p>
      {table.matchCount < SMALL_SAMPLE_MATCHES ? (
        <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
          {t("smallSample")}
        </p>
      ) : null}
      <StatsTable rows={rows} />
    </section>
  );
}
