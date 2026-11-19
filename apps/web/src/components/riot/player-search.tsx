"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { parseRiotId, riotPath } from "@/lib/riot-paths";

export function PlayerSearch({ defaultValue = "" }: Readonly<{ defaultValue?: string }>) {
  const t = useTranslations("players");
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const [invalid, setInvalid] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("riotId");
    const riotId = parseRiotId(typeof value === "string" ? value : "");
    setInvalid(!riotId);
    if (riotId) {
      router.push(riotPath.player(riotId.gameName, riotId.tagLine));
    }
  };

  return (
    <form role="search" onSubmit={submit} noValidate className="space-y-2">
      <label htmlFor={inputId} className="sr-only">
        {t("title")}
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          type="search"
          name="riotId"
          defaultValue={defaultValue}
          placeholder={t("placeholder")}
          autoComplete="off"
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          className="min-w-0 flex-1 rounded-lg border border-line/20 bg-surface/5 px-3 py-2 outline-none focus:border-primary"
        />
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary hover:bg-primary-hover"
        >
          {t("search")}
        </button>
      </div>
      {invalid ? (
        <p id={errorId} className="text-sm text-danger">
          {t("invalid")}
        </p>
      ) : null}
    </form>
  );
}
