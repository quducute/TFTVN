"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

export function PlannerCodeCopy({ code }: Readonly<{ code: string | null }>) {
  const t = useTranslations("comps.detail");
  const id = useId();
  const [copied, setCopied] = useState(false);

  if (!code) {
    return <p className="text-sm text-muted">{t("noPlannerCode")}</p>;
  }

  const copy = () => {
    navigator.clipboard.writeText(code).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm text-muted">
        {t("plannerCode")}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          readOnly
          value={code}
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-line/20 bg-surface/5 px-3 py-2 font-mono text-xs"
        />
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border border-primary px-3 py-2 text-sm text-primary hover:bg-primary hover:text-on-primary"
        >
          {copied ? t("copied") : t("copy")}
        </button>
      </div>
    </div>
  );
}
