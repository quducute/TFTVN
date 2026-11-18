"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

type State = "checking" | "ok" | "error";

export function ApiStatus() {
  const t = useTranslations("home");
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let active = true;
    api
      .get<{ ok: boolean }>("/health/db")
      .then((response) => active && setState(response.data.ok ? "ok" : "error"))
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, []);

  const tone = { checking: "text-muted", ok: "text-success", error: "text-danger" }[state];
  return <span className={tone}>{t(state)}</span>;
}
