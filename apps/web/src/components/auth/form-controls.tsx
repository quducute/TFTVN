"use client";

import type { AuthErrorCode } from "@tftvn/core";
import { useTranslations } from "next-intl";
import { type InputHTMLAttributes, type ReactNode, useId } from "react";
import { cn } from "@/lib/cn";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label: string;
  error?: AuthErrorCode;
  hint?: string;
}

export function TextField({
  name,
  label,
  error,
  hint,
  className,
  ...input
}: Readonly<TextFieldProps>) {
  const t = useTranslations("auth.errors");
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm text-muted">
        {label}
      </label>
      <input
        {...input}
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "w-full rounded-lg border bg-surface/5 px-3 py-2 text-text outline-none placeholder:text-muted focus:border-primary",
          error ? "border-danger" : "border-line/20",
          className,
        )}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          {t(error)}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormNotice({
  tone,
  children,
}: Readonly<{ tone: "error" | "success"; children: ReactNode }>) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        tone === "error" ? "border-danger/40 text-danger" : "border-success/40 text-success",
      )}
    >
      {children}
    </p>
  );
}

export function SubmitButton({
  pending,
  children,
}: Readonly<{ pending: boolean; children: ReactNode }>) {
  const t = useTranslations("auth");
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60"
    >
      {pending ? t("submitting") : children}
    </button>
  );
}

export function AuthCard({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-xl border border-line/10 bg-surface/5 p-6">
        <h1 className="mb-6 text-2xl font-bold text-primary">{title}</h1>
        {children}
      </div>
    </main>
  );
}
