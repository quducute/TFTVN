"use client";

import { ARTICLE_CATEGORIES, type ArticleErrorCode, type ArticleFieldErrors } from "@tftvn/core";
import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useRouter } from "@/i18n/navigation";
import { api, toApiFailure } from "@/lib/api-client";
import { articlePath } from "@/lib/article-paths";
import { cn } from "@/lib/cn";
import type { PublicArticle } from "@/server/articles/types";
import { RichTextEditor } from "./rich-text-editor";

const UUID_IN_TEXT = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

interface ArticleEditorProps {
  sets: number[];
  initial?: PublicArticle;
}

export function ArticleEditor({ sets, initial }: ArticleEditorProps) {
  const t = useTranslations("articles");
  const { user } = useAuth();
  const router = useRouter();
  const ids = {
    title: useId(),
    category: useId(),
    set: useId(),
    tags: useId(),
    body: useId(),
    bodyError: useId(),
    comps: useId(),
  };

  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState<string>(initial?.category ?? "guide");
  const [setId, setSetId] = useState(initial?.setId == null ? "" : String(initial.setId));
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [comps, setComps] = useState(initial?.compIds.join("\n") ?? "");
  const [fieldErrors, setFieldErrors] = useState<ArticleFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const errorText = (code: ArticleErrorCode | "unknown" | undefined) =>
    code ? t(`errors.${code}`) : null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    setFormError(null);
    const payload = {
      title,
      category,
      setId: setId ? Number(setId) : null,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      body,
      compIds: comps.match(UUID_IN_TEXT) ?? [],
    };
    try {
      const response = initial
        ? await api.put<{ article: PublicArticle }>(`/articles/${initial.publicId}`, payload)
        : await api.post<{ article: PublicArticle }>("/articles", payload);
      router.push(articlePath.detail(response.data.article.publicId));
      router.refresh();
    } catch (error) {
      const failure = toApiFailure<ArticleErrorCode>(error);
      setFieldErrors(failure.fields);
      setFormError(errorText(failure.code));
      setSaving(false);
    }
  };

  const inputClass = (invalid: boolean) =>
    cn(
      "w-full rounded-lg border bg-surface/5 px-3 py-2 outline-none focus:border-primary",
      invalid ? "border-danger" : "border-line/20",
    );

  const fieldError = (field: string) =>
    fieldErrors[field] ? (
      <p className="mt-1 text-sm text-danger">{errorText(fieldErrors[field])}</p>
    ) : null;

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <h1 className="text-3xl font-bold text-primary">
        {initial ? t("editor.editTitle") : t("editor.newTitle")}
      </h1>
      {user?.role === "admin" ? null : (
        <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
          {t("editor.reviewNotice")}
        </p>
      )}
      {formError ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger"
        >
          {formError}
        </p>
      ) : null}

      <div>
        <label htmlFor={ids.title} className="mb-1 block text-sm text-muted">
          {t("editor.titleField")}
        </label>
        <input
          id={ids.title}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={fieldErrors.title ? true : undefined}
          className={inputClass(fieldErrors.title != null)}
        />
        {fieldError("title")}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={ids.category} className="mb-1 block text-sm text-muted">
            {t("editor.category")}
          </label>
          <select
            id={ids.category}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className={cn(inputClass(false), "bg-bg")}
          >
            {ARTICLE_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {t(`categories.${value}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={ids.set} className="mb-1 block text-sm text-muted">
            {t("editor.set")}
          </label>
          <select
            id={ids.set}
            value={setId}
            onChange={(event) => setSetId(event.target.value)}
            className={cn(inputClass(fieldErrors.setId != null), "bg-bg")}
          >
            <option value="">{t("editor.noSet")}</option>
            {sets.map((set) => (
              <option key={set} value={set}>
                {t("setLabel", { set })}
              </option>
            ))}
          </select>
          {fieldError("setId")}
        </div>
        <div>
          <label htmlFor={ids.tags} className="mb-1 block text-sm text-muted">
            {t("editor.tags")}
          </label>
          <input
            id={ids.tags}
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            aria-invalid={fieldErrors.tags ? true : undefined}
            className={inputClass(fieldErrors.tags != null)}
          />
          {fieldError("tags")}
        </div>
      </div>

      <div>
        <label htmlFor={ids.body} className="mb-1 block text-sm text-muted">
          {t("editor.body")}
        </label>
        <RichTextEditor
          id={ids.body}
          label={t("editor.body")}
          initialHtml={initial?.body ?? ""}
          invalid={fieldErrors.body != null}
          describedBy={fieldErrors.body ? ids.bodyError : undefined}
          onChange={setBody}
        />
        {fieldErrors.body ? (
          <p id={ids.bodyError} className="mt-1 text-sm text-danger">
            {errorText(fieldErrors.body)}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={ids.comps} className="mb-1 block text-sm text-muted">
          {t("editor.comps")}
        </label>
        <textarea
          id={ids.comps}
          rows={3}
          value={comps}
          onChange={(event) => setComps(event.target.value)}
          className={cn(inputClass(fieldErrors.compIds != null), "font-mono text-xs")}
        />
        {fieldError("compIds")}
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60"
      >
        {saving
          ? t("editor.saving")
          : user?.role === "admin"
            ? t("editor.saveAdmin")
            : t("editor.save")}
      </button>
    </form>
  );
}
