"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "./auth-provider";

export function UserMenu() {
  const t = useTranslations("auth.nav");
  const { user, status } = useAuth();

  if (status === "loading") {
    return <span className="h-8 w-24 animate-pulse rounded-md bg-surface/10" />;
  }
  if (!user) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Link href="/login" className="text-muted hover:text-primary">
          {t("login")}
        </Link>
        <Link
          href="/register"
          className="rounded-md bg-primary px-3 py-1 font-semibold text-on-primary hover:bg-primary-hover"
        >
          {t("register")}
        </Link>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 text-sm">
      {user.role === "admin" ? (
        <Link href="/admin" className="text-muted hover:text-primary">
          {t("admin")}
        </Link>
      ) : null}
      <Link href="/profile" className="font-medium text-primary hover:text-primary-hover">
        {user.username}
      </Link>
    </div>
  );
}
