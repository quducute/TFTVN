"use client";

import { REACTION_KINDS, type ReactionKind } from "@tftvn/core";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";

type ReactionState = { counts: Record<ReactionKind, number>; mine: ReactionKind | null };

const SYMBOL: Record<ReactionKind, string> = { heart: "<3", like: "+", dislike: "-" };

export function ReactionBar({ publicId }: Readonly<{ publicId: string }>) {
  const t = useTranslations("articles.reactions");
  const { user, status } = useAuth();
  const [state, setState] = useState<ReactionState | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (status === "loading") {
      return;
    }
    let active = true;
    api.get<ReactionState>(`/articles/${publicId}/reactions`).then(
      (response) => active && setState(response.data),
      () => active && setState(null),
    );
    return () => {
      active = false;
    };
  }, [publicId, status, user?.id]);

  const react = async (kind: ReactionKind) => {
    setPending(true);
    try {
      const response = await api.put<ReactionState>(`/articles/${publicId}/reaction`, {
        kind: state?.mine === kind ? null : kind,
      });
      setState(response.data);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {REACTION_KINDS.map((kind) => (
        <button
          key={kind}
          type="button"
          disabled={status !== "authenticated" || pending || !state}
          aria-pressed={state?.mine === kind}
          onClick={() => void react(kind)}
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm disabled:cursor-not-allowed",
            state?.mine === kind
              ? "border-primary bg-primary text-on-primary"
              : "border-line/20 hover:border-primary",
          )}
        >
          <span aria-hidden className="font-mono">
            {SYMBOL[kind]}
          </span>
          {t(kind)}
          <span className="tabular-nums">{state?.counts[kind] ?? 0}</span>
        </button>
      ))}
      {status === "guest" ? (
        <Link href="/login" className="text-sm text-muted hover:text-primary">
          {t("loginToReact")}
        </Link>
      ) : null}
    </div>
  );
}
