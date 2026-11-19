"use client";

import type { ArticleErrorCode } from "@tftvn/core";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { api, toApiFailure } from "@/lib/api-client";

export function ReviewForm({ publicId }: Readonly<{ publicId: string }>) {
  const t = useTranslations("admin.review");
  const tErrors = useTranslations("articles.errors");
  const router = useRouter();
  const noteId = useId();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const review = async (status: "approved" | "rejected") => {
    setPending(true);
    setError(null);
    try {
      await api.put(`/articles/${publicId}/review`, { status, note });
      router.refresh();
    } catch (failure) {
      setError(tErrors(toApiFailure<ArticleErrorCode>(failure).code));
      setPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <label htmlFor={noteId} className="block text-sm text-muted">
        {t("note")}
      </label>
      <textarea
        id={noteId}
        rows={2}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        className="w-full rounded-lg border border-line/20 bg-surface/5 px-3 py-2 text-sm outline-none focus:border-primary"
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => void review("approved")}
          className="rounded-lg bg-primary px-4 py-1.5 font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60"
        >
          {t("approve")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void review("rejected")}
          className="rounded-lg border border-danger/60 px-4 py-1.5 text-danger hover:bg-danger/10 disabled:opacity-60"
        >
          {t("reject")}
        </button>
      </div>
    </div>
  );
}
