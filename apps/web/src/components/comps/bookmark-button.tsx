"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api-client";

type BookmarkState = { bookmarked: boolean; count: number };

export function BookmarkButton({ publicId }: Readonly<{ publicId: string }>) {
  const t = useTranslations("comps");
  const { user, status } = useAuth();
  const [state, setState] = useState<BookmarkState | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (status === "loading") {
      return;
    }
    let active = true;
    api.get<BookmarkState>(`/comps/${publicId}/bookmark`).then(
      (response) => active && setState(response.data),
      () => active && setState({ bookmarked: false, count: 0 }),
    );
    return () => {
      active = false;
    };
  }, [publicId, status, user?.id]);

  const toggle = async () => {
    if (!state) {
      return;
    }
    setPending(true);
    try {
      const response = state.bookmarked
        ? await api.delete<BookmarkState>(`/comps/${publicId}/bookmark`)
        : await api.put<BookmarkState>(`/comps/${publicId}/bookmark`);
      setState(response.data);
    } finally {
      setPending(false);
    }
  };

  const count = state ? t("bookmark.count", { count: state.count }) : null;

  if (status === "guest") {
    return (
      <p className="flex items-center gap-3 text-sm">
        <Link href="/login" className="rounded-lg border border-primary px-3 py-1.5 text-primary">
          {t("bookmark.add")}
        </Link>
        <span className="text-muted">{count}</span>
      </p>
    );
  }

  return (
    <p className="flex items-center gap-3 text-sm">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={!state || pending}
        aria-pressed={state?.bookmarked ?? false}
        className={
          state?.bookmarked
            ? "rounded-lg bg-primary px-3 py-1.5 font-semibold text-on-primary disabled:opacity-60"
            : "rounded-lg border border-primary px-3 py-1.5 text-primary disabled:opacity-60"
        }
      >
        {state?.bookmarked ? t("bookmark.remove") : t("bookmark.add")}
      </button>
      <span className="text-muted">{count}</span>
    </p>
  );
}
