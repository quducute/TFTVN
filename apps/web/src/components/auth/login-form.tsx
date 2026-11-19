"use client";

import { loginSchema } from "@tftvn/core";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api-client";
import type { PublicUser } from "@/server/auth/types";
import { useAuth } from "./auth-provider";
import { FormNotice, SubmitButton, TextField } from "./form-controls";
import { useAuthForm } from "./use-auth-form";

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { setUser } = useAuth();
  const { fields, formError, pending, onSubmit } = useAuthForm(loginSchema, async (values) => {
    const response = await api.post<{ user: PublicUser }>("/auth/login", values);
    setUser(response.data.user);
    router.push("/");
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError ? <FormNotice tone="error">{t(`errors.${formError}`)}</FormNotice> : null}
      <TextField
        name="identifier"
        label={t("fields.identifier")}
        autoComplete="username"
        error={fields.identifier}
      />
      <TextField
        name="password"
        type="password"
        label={t("fields.password")}
        autoComplete="current-password"
        error={fields.password}
      />
      <SubmitButton pending={pending}>{t("login.submit")}</SubmitButton>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="text-muted hover:text-primary">
          {t("login.forgot")}
        </Link>
        <span className="text-muted">
          {t("login.noAccount")}{" "}
          <Link href="/register" className="text-primary hover:text-primary-hover">
            {t("nav.register")}
          </Link>
        </span>
      </div>
    </form>
  );
}
