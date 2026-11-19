import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-20 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted">{t("description")}</p>
      <Link
        href="/"
        className="inline-block rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary hover:bg-primary-hover"
      >
        {t("home")}
      </Link>
    </main>
  );
}
