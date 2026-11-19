import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/form-controls";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const t = await getTranslations("auth.login");
  return (
    <AuthCard title={t("title")}>
      <LoginForm />
    </AuthCard>
  );
}
