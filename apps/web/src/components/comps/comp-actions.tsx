"use client";

import { type CompErrorCode, META_TIERS, type MetaTier } from "@tftvn/core";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Link, useRouter } from "@/i18n/navigation";
import { api, toApiFailure } from "@/lib/api-client";
import { compPath } from "@/lib/comp-paths";

interface CompActionsProps {
  publicId: string;
  ownerId: number;
  metaTier: MetaTier | null;
}

export function CompActions({ publicId, ownerId, metaTier }: CompActionsProps) {
  const t = useTranslations("comps");
  const { user } = useAuth();
  const router = useRouter();
  const tierId = useId();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  if (!user || (user.id !== ownerId && user.role !== "admin")) {
    return null;
  }

  const run = async (action: () => Promise<void>) => {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await action();
    } catch (failure) {
      setError(t(`errors.${toApiFailure<CompErrorCode>(failure).code}`));
    } finally {
      setPending(false);
    }
  };

  const remove = () =>
    run(async () => {
      if (!window.confirm(t("confirmDelete"))) {
        return;
      }
      await api.delete(`/comps/${publicId}`);
      router.push(compPath.list("mine"));
      router.refresh();
    });

  const changeTier = (value: string) =>
    run(async () => {
      await api.put(`/comps/${publicId}/meta`, { tier: value || null });
      setSaved(true);
      router.refresh();
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={compPath.edit(publicId)}
          className="rounded-lg border border-line/20 px-3 py-1.5 hover:border-primary hover:text-primary"
        >
          {t("edit")}
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={() => void remove()}
          className="rounded-lg border border-danger/60 px-3 py-1.5 text-danger hover:bg-danger/10 disabled:opacity-60"
        >
          {t("delete")}
        </button>
        {user.role === "admin" ? (
          <span className="flex items-center gap-2">
            <label htmlFor={tierId} className="text-muted">
              {t("meta.label")}
            </label>
            <select
              id={tierId}
              disabled={pending}
              value={metaTier ?? ""}
              onChange={(event) => void changeTier(event.target.value)}
              className="rounded-lg border border-line/20 bg-bg px-2 py-1.5"
            >
              <option value="">{t("meta.none")}</option>
              {META_TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </span>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-success">
          {t("meta.saved")}
        </p>
      ) : null}
    </div>
  );
}
