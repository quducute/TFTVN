import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/form-controls";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";

export default async function ResetPasswordPage() {
  const t = await getTranslations("auth.reset");
  return (
    <AuthCard title={t("title")}>
      <Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-surface/5" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
