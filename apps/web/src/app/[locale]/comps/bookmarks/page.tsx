import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { UserCompList } from "@/components/comps/user-comp-list";
import { currentLocale } from "@/i18n/locale";
import { firstParam } from "@/server/comps/page-data";

type SearchParams = PageProps<"/[locale]/comps/bookmarks">["searchParams"];

export async function generateMetadata() {
  const t = await getTranslations({ locale: await currentLocale(), namespace: "comps" });
  return { title: `${t("tabs.bookmarks")} - ${t("title")}` };
}

export default function BookmarkedCompsPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-6xl animate-pulse bg-surface/5" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const { page } = await searchParams;
  return <UserCompList kind="bookmarks" page={Number(firstParam(page)) || 1} />;
}
