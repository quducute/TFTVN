import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { type ReactNode, Suspense } from "react";
import { AuthProvider } from "@/components/auth/auth-provider";
import { UserMenu } from "@/components/auth/user-menu";
import { LanguageSwitcher } from "@/components/language-switcher";
import { currentLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { libraryPath } from "@/lib/library-paths";
import { riotPath } from "@/lib/riot-paths";
import "../globals.css";

const font = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("title"), description: t("description") };
}

export default async function LocaleLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = await currentLocale();
  const t = await getTranslations("nav");

  return (
    <html lang={locale}>
      <body className={`${font.className} min-h-dvh bg-bg text-text antialiased`}>
        <NextIntlClientProvider>
          <AuthProvider>
            <header className="border-b border-line/10">
              <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
                <div className="flex items-center gap-6">
                  <Link href="/" className="text-lg font-bold tracking-tight">
                    TFT<span className="text-primary">VN</span>
                  </Link>
                  <nav className="flex gap-4 text-sm">
                    {[
                      { href: libraryPath.root(), label: t("library") },
                      { href: riotPath.players(), label: t("players") },
                      { href: riotPath.leaderboard(), label: t("leaderboard") },
                      { href: "/stats", label: t("stats") },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="text-muted hover:text-primary"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </nav>
                </div>
                <div className="flex items-center gap-4">
                  <UserMenu />
                  <Suspense fallback={<span className="w-20" />}>
                    <LanguageSwitcher />
                  </Suspense>
                </div>
              </div>
            </header>
            {children}
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
