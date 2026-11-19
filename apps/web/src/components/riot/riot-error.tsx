import { getTranslations } from "next-intl/server";

export type RiotErrorKind =
  "notFound" | "rateLimited" | "unauthorized" | "unavailable" | "tooManyLookups";

export async function RiotErrorPanel({ kind }: Readonly<{ kind: RiotErrorKind }>) {
  const t = await getTranslations("riot.errors");
  return (
    <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm">
      {t(kind)}
    </p>
  );
}
