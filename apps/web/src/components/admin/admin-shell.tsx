import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { ViewerSync } from "@/components/auth/viewer-sync";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import type { AccessTokenClaims } from "@/server/auth/types";
import { getViewer } from "@/server/auth/viewer";

const TABS = [
  { key: "review", href: "/admin" },
  { key: "roles", href: "/admin/roles" },
  { key: "users", href: "/admin/users" },
] as const;

export async function AdminShell({
  tab,
  children,
}: Readonly<{
  tab: (typeof TABS)[number]["key"];
  children: (viewer: AccessTokenClaims) => ReactNode;
}>) {
  const [t, viewer] = await Promise.all([getTranslations("admin"), getViewer()]);

  if (!viewer || viewer.role !== "admin") {
    return (
      <>
        <ViewerSync serverUserId={viewer?.userId ?? null} />
        <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
        <p role="alert" className="text-muted">
          {viewer ? t("forbidden") : t("loginRequired")}{" "}
          {viewer ? null : (
            <Link href="/login" className="text-primary hover:underline">
              {t("login")}
            </Link>
          )}
        </p>
      </>
    );
  }

  return (
    <>
      <ViewerSync serverUserId={viewer.userId} />
      <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
      <nav>
        <ul className="flex gap-1 rounded-lg border border-line/10 p-1 text-sm">
          {TABS.map((entry) => (
            <li key={entry.key}>
              <Link
                href={entry.href}
                aria-current={entry.key === tab ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-1.5",
                  entry.key === tab
                    ? "bg-primary font-semibold text-on-primary"
                    : "text-muted hover:text-primary",
                )}
              >
                {t(`tabs.${entry.key}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children(viewer)}
    </>
  );
}
