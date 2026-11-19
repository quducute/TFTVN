"use client";

import type { ArticleErrorCode } from "@tftvn/core";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Link, useRouter } from "@/i18n/navigation";
import { api, toApiFailure } from "@/lib/api-client";
import { articlePath } from "@/lib/article-paths";

export function ArticleActions({
  publicId,
  authorId,
}: Readonly<{ publicId: string; authorId: number }>) {
  const t = useTranslations("articles");
  const { user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  if (!user || (user.id !== authorId && user.role !== "admin")) {
    return null;
  }

  const remove = async () => {
    if (!window.confirm(t("confirmDelete"))) {
      return;
    }
    try {
      await api.delete(`/articles/${publicId}`);
      router.push(articlePath.mine());
      router.refresh();
    } catch (failure) {
      setError(t(`errors.${toApiFailure<ArticleErrorCode>(failure).code}`));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-sm">
        <Link
          href={articlePath.edit(publicId)}
          prefetch={false}
          className="rounded-lg border border-line/20 px-3 py-1.5 hover:border-primary hover:text-primary"
        >
          {t("edit")}
        </Link>
        <button
          type="button"
          onClick={() => void remove()}
          className="rounded-lg border border-danger/60 px-3 py-1.5 text-danger hover:bg-danger/10"
        >
          {t("delete")}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
