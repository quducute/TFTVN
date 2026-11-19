"use client";

import { forgotPasswordSchema, passwordSchema } from "@tftvn/core";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api-client";
import { FormNotice, SubmitButton, TextField } from "./form-controls";
import { useAuthForm } from "./use-auth-form";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [sent, setSent] = useState(false);
  const { fields, formError, pending, onSubmit } = useAuthForm(
    forgotPasswordSchema,
    async (values) => {
      await api.post("/auth/forgot-password", values);
      setSent(true);
    },
  );

  if (sent) {
    return <FormNotice tone="success">{t("forgot.sent")}</FormNotice>;
  }
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <p className="text-sm text-muted">{t("forgot.description")}</p>
      {formError ? <FormNotice tone="error">{t(`errors.${formError}`)}</FormNotice> : null}
      <input type="hidden" name="locale" value={locale} />
      <TextField
        name="email"
        type="email"
        label={t("fields.email")}
        autoComplete="email"
        error={fields.email}
      />
      <SubmitButton pending={pending}>{t("forgot.submit")}</SubmitButton>
    </form>
  );
}

const resetFormSchema = z.object({ password: passwordSchema });

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState(false);
  const { fields, formError, pending, onSubmit } = useAuthForm(
    resetFormSchema,
    async ({ password }) => {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    },
  );

  if (!token) {
    return <FormNotice tone="error">{t("reset.missingToken")}</FormNotice>;
  }
  if (done) {
    return (
      <div className="space-y-4">
        <FormNotice tone="success">{t("reset.done")}</FormNotice>
        <Link href="/login" className="block text-center text-primary hover:text-primary-hover">
          {t("nav.login")}
        </Link>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError ? <FormNotice tone="error">{t(`errors.${formError}`)}</FormNotice> : null}
      <TextField
        name="password"
        type="password"
        label={t("fields.newPassword")}
        autoComplete="new-password"
        hint={t("register.passwordHint")}
        error={fields.password ?? fields.token}
      />
      <SubmitButton pending={pending}>{t("reset.submit")}</SubmitButton>
    </form>
  );
}
