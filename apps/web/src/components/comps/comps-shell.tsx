import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { COMP_TABS, type CompTab, compPath } from "@/lib/comp-paths";

interface CompsShellProps {
  tab: CompTab;
  setId?: number | null;
  children: ReactNode;
}

export async function CompsShell({ tab, setId = null, children }: CompsShellProps) {
  const t = await getTranslations("comps");

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
          <p className="mt-1 text-muted">{t("description")}</p>
          {setId ? (
            <p className="mt-1 text-sm text-primary">{t("setLabel", { set: setId })}</p>
          ) : null}
        </div>
        <Link
          href={compPath.create()}
          className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary hover:bg-primary-hover"
        >
          {t("create")}
        </Link>
      </header>
      <nav className="flex flex-wrap items-center gap-4">
        <ul className="flex gap-1 rounded-lg border border-line/10 p-1 text-sm">
          {COMP_TABS.map((value) => (
            <li key={value}>
              <Link
                href={compPath.list(value)}
                aria-current={value === tab ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-1.5",
                  value === tab
                    ? "bg-primary font-semibold text-on-primary"
                    : "text-muted hover:text-primary",
                )}
              >
                {t(`tabs.${value}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </main>
  );
}

export function CompGrid({ children }: Readonly<{ children: ReactNode }>) {
  return <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</ul>;
}

export function Pagination({
  page,
  pages,
  href,
  labels,
}: Readonly<{
  page: number;
  pages: number;
  href: (page: number) => string;
  labels: { previous: string; next: string; page: string };
}>) {
  if (pages <= 1) {
    return null;
  }
  const item = "rounded-lg border border-line/20 px-3 py-1.5";
  return (
    <nav aria-label={labels.page} className="flex items-center justify-between text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className={cn(item, "hover:border-primary hover:text-primary")}>
          {labels.previous}
        </Link>
      ) : (
        <span aria-disabled className={cn(item, "opacity-50")}>
          {labels.previous}
        </span>
      )}
      <span className="text-muted">{labels.page}</span>
      {page < pages ? (
        <Link href={href(page + 1)} className={cn(item, "hover:border-primary hover:text-primary")}>
          {labels.next}
        </Link>
      ) : (
        <span aria-disabled className={cn(item, "opacity-50")}>
          {labels.next}
        </span>
      )}
    </nav>
  );
}
