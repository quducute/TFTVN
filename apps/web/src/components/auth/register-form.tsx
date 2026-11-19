"use client";

import { registerSchema } from "@tftvn/core";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api-client";
import type { PublicUser } from "@/server/auth/types";
import { useAuth } from "./auth-provider";
import { FormNotice, SubmitButton, TextField } from "./form-controls";
import { useAuthForm } from "./use-auth-form";

export function RegisterForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { setUser } = useAuth();
  const { fields, formError, pending, onSubmit } = useAuthForm(registerSchema, async (values) => {
    const response = await api.post<{ user: PublicUser }>("/auth/register", values);
    setUser(response.data.user);
    router.push("/profile");
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError ? <FormNotice tone="error">{t(`errors.${formError}`)}</FormNotice> : null}
      <TextField
        name="username"
        label={t("fields.username")}
        autoComplete="username"
        hint={t("register.usernameHint")}
        error={fields.username}
      />
      <TextField
        name="email"
        type="email"
        label={t("fields.email")}
        autoComplete="email"
        error={fields.email}
      />
      <TextField
        name="password"
        type="password"
        label={t("fields.password")}
        autoComplete="new-password"
        hint={t("register.passwordHint")}
        error={fields.password}
      />
      <SubmitButton pending={pending}>{t("register.submit")}</SubmitButton>
      <p className="text-center text-sm text-muted">
        {t("register.hasAccount")}{" "}
        <Link href="/login" className="text-primary hover:text-primary-hover">
          {t("nav.login")}
        </Link>
      </p>
    </form>
  );
}
