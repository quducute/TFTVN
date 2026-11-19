"use client";

import { changePasswordSchema, riotIdSchema, updateProfileSchema } from "@tftvn/core";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api-client";
import { riotPath } from "@/lib/riot-paths";
import type { PublicUser } from "@/server/auth/types";
import { useAuth } from "./auth-provider";
import { FormNotice, SubmitButton, TextField } from "./form-controls";
import { useAuthForm } from "./use-auth-form";

function Section({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section className="rounded-xl border border-line/10 bg-surface/5 p-6">
      <h2 className="mb-4 text-lg font-semibold text-primary">{title}</h2>
      {children}
    </section>
  );
}

function AccountForm({ user }: Readonly<{ user: PublicUser }>) {
  const t = useTranslations("auth");
  const { setUser } = useAuth();
  const [saved, setSaved] = useState(false);
  const { fields, formError, pending, onSubmit } = useAuthForm(
    updateProfileSchema,
    async (values) => {
      const changes = {
        ...(values.username && values.username !== user.username
          ? { username: values.username }
          : {}),
        ...(values.email && values.email !== user.email ? { email: values.email } : {}),
      };
      const response = await api.patch<{ user: PublicUser }>("/users/me", changes);
      setUser(response.data.user);
      setSaved(true);
    },
  );

  return (
    <form
      onSubmit={(event) => {
        setSaved(false);
        void onSubmit(event);
      }}
      noValidate
      className="space-y-4"
    >
      {formError ? <FormNotice tone="error">{t(`errors.${formError}`)}</FormNotice> : null}
      {saved ? <FormNotice tone="success">{t("profile.saved")}</FormNotice> : null}
      <TextField
        name="username"
        label={t("fields.username")}
        defaultValue={user.username}
        error={fields.username}
      />
      <TextField
        name="email"
        type="email"
        label={t("fields.email")}
        defaultValue={user.email}
        error={fields.email}
      />
      <SubmitButton pending={pending}>{t("profile.save")}</SubmitButton>
    </form>
  );
}

function PasswordForm() {
  const t = useTranslations("auth");
  const [done, setDone] = useState(false);
  const [version, setVersion] = useState(0);
  const { fields, formError, pending, onSubmit } = useAuthForm(
    changePasswordSchema,
    async (values) => {
      await api.post("/users/me/password", values);
      setDone(true);
      setVersion((current) => current + 1);
    },
  );

  return (
    <form key={version} onSubmit={onSubmit} noValidate className="space-y-4">
      {formError ? <FormNotice tone="error">{t(`errors.${formError}`)}</FormNotice> : null}
      {done ? <FormNotice tone="success">{t("profile.passwordChanged")}</FormNotice> : null}
      <TextField
        name="currentPassword"
        type="password"
        label={t("fields.currentPassword")}
        autoComplete="current-password"
        error={fields.currentPassword}
      />
      <TextField
        name="newPassword"
        type="password"
        label={t("fields.newPassword")}
        autoComplete="new-password"
        hint={t("register.passwordHint")}
        error={fields.newPassword}
      />
      <SubmitButton pending={pending}>{t("profile.changePassword")}</SubmitButton>
    </form>
  );
}

function RiotForm({ user }: Readonly<{ user: PublicUser }>) {
  const t = useTranslations("auth");
  const { setUser } = useAuth();
  const { fields, formError, pending, onSubmit, setFormError } = useAuthForm(
    riotIdSchema,
    async (values) => {
      const response = await api.put<{ user: PublicUser }>("/users/me/riot", values);
      setUser(response.data.user);
    },
  );

  async function unlink() {
    setFormError(null);
    const response = await api.delete<{ user: PublicUser }>("/users/me/riot");
    setUser(response.data.user);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t("profile.riotDescription")}</p>
      {user.riot ? (
        <div className="flex items-center justify-between rounded-lg border border-line/10 px-3 py-2">
          <div>
            <p className="font-medium">
              {t("profile.linked", { riotId: `${user.riot.gameName}#${user.riot.tagLine}` })}
            </p>
            {user.riot.verified ? null : (
              <p className="text-xs text-muted">{t("profile.unverified")}</p>
            )}
            <Link
              href={riotPath.player(user.riot.gameName, user.riot.tagLine)}
              className="text-xs text-primary hover:underline"
            >
              {t("profile.viewPlayer")}
            </Link>
          </div>
          <button
            type="button"
            onClick={() => void unlink()}
            className="text-sm text-danger hover:underline"
          >
            {t("profile.unlink")}
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted">{t("profile.notLinked")}</p>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError ? <FormNotice tone="error">{t(`errors.${formError}`)}</FormNotice> : null}
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <TextField
            name="gameName"
            label={t("fields.gameName")}
            defaultValue={user.riot?.gameName}
            error={fields.gameName}
          />
          <TextField
            name="tagLine"
            label={t("fields.tagLine")}
            defaultValue={user.riot?.tagLine}
            error={fields.tagLine}
          />
        </div>
        <SubmitButton pending={pending}>{t("profile.link")}</SubmitButton>
      </form>
    </div>
  );
}

export function ProfileView() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { user, status, logout } = useAuth();

  useEffect(() => {
    if (status === "guest") {
      router.replace("/login");
    }
  }, [status, router]);

  if (!user) {
    return <div className="h-40 animate-pulse rounded-xl bg-surface/5" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">{t("profile.title")}</h1>
          <p className="text-sm text-muted">
            {user.username}
            {user.role === "admin" ? ` - ${t("profile.admin")}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout().then(() => router.push("/"))}
          className="rounded-lg border border-line/20 px-3 py-1.5 text-sm hover:border-danger hover:text-danger"
        >
          {t("nav.logout")}
        </button>
      </div>
      <Section title={t("profile.account")}>
        <AccountForm key={user.id} user={user} />
      </Section>
      <Section title={t("profile.password")}>
        <PasswordForm />
      </Section>
      <Section title={t("profile.riot")}>
        <RiotForm user={user} />
      </Section>
    </div>
  );
}
