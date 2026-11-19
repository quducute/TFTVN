"use client";

import { type AuthErrorCode, type FieldErrors, dropEmptyStrings, toFieldErrors } from "@tftvn/core";
import { type FormEvent, useState } from "react";
import type { ZodType } from "zod";
import { toApiFailure } from "@/lib/api-client";

export function useAuthForm<T>(schema: ZodType<T>, submit: (values: T) => Promise<void>) {
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<AuthErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = schema.safeParse(dropEmptyStrings(values));
    setFormError(null);
    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      setFields(errors);
      setFormError(errors.form ?? null);
      return;
    }
    setFields({});
    setPending(true);
    try {
      await submit(parsed.data);
    } catch (error) {
      const failure = toApiFailure(error);
      setFields(failure.fields);
      if (Object.keys(failure.fields).length === 0) {
        setFormError(failure.code);
      }
    } finally {
      setPending(false);
    }
  }

  return { fields, formError, pending, onSubmit, setFormError };
}
