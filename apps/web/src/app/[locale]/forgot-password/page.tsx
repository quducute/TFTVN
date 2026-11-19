import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/form-controls";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.forgot");
  return (
    <AuthCard title={t("title")}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
