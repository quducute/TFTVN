import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/form-controls";
import { RegisterForm } from "@/components/auth/register-form";

export default async function RegisterPage() {
  const t = await getTranslations("auth.register");
  return (
    <AuthCard title={t("title")}>
      <RegisterForm />
    </AuthCard>
  );
}
