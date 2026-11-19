import { redirect } from "@/i18n/navigation";
import { currentLocale } from "@/i18n/locale";
import { riotPath } from "@/lib/riot-paths";

export default async function StatsIndexPage() {
  redirect({ href: riotPath.stats("challenger", "champions"), locale: await currentLocale() });
}
