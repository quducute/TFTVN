"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { api, toApiFailure } from "@/lib/api-client";
import type { AdminErrorCode } from "@/server/admin/service";

export function UserRoleSelect({
  userId,
  username,
  role,
  isSelf,
}: Readonly<{ userId: number; username: string; role: "user" | "admin"; isSelf: boolean }>) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const change = async (next: string) => {
    setPending(true);
    setError(null);
    try {
      await api.put(`/admin/users/${userId}/role`, { role: next });
      router.refresh();
    } catch (failure) {
      setError(t(`errors.${toApiFailure<AdminErrorCode>(failure).code}`));
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <select
        aria-label={t("users.roleOf", { username })}
        value={role}
        disabled={isSelf || pending}
        title={isSelf ? t("errors.cannotChangeSelf") : undefined}
        onChange={(event) => void change(event.target.value)}
        className="rounded-lg border border-line/20 bg-bg px-2 py-1 disabled:opacity-60"
      >
        <option value="user">{t("users.roles.user")}</option>
        <option value="admin">{t("users.roles.admin")}</option>
      </select>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
