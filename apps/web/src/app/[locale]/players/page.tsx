import { getTranslations } from "next-intl/server";
import { PlayerSearch } from "@/components/riot/player-search";
import { currentLocale } from "@/i18n/locale";

export async function generateMetadata() {
  const t = await getTranslations({ locale: await currentLocale(), namespace: "players" });
  return { title: t("title") };
}

export default async function PlayersPage() {
  const t = await getTranslations({ locale: await currentLocale(), namespace: "players" });
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
      <p className="mt-2 mb-6 text-muted">{t("description")}</p>
      <PlayerSearch />
    </main>
  );
}
