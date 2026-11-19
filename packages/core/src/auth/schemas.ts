import { z } from "zod";

export const AUTH_ERROR_CODES = [
  "required",
  "usernameTooShort",
  "usernameTooLong",
  "usernameInvalid",
  "emailInvalid",
  "passwordTooShort",
  "passwordTooLong",
  "nothingToUpdate",
  "tokenInvalid",
  "gameNameInvalid",
  "tagLineInvalid",
  "invalidCredentials",
  "usernameTaken",
  "emailTaken",
  "currentPasswordWrong",
  "riotNotFound",
  "riotUnavailable",
  "rateLimited",
  "forbiddenOrigin",
  "unauthorized",
  "unknown",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

const required = { error: "required" } as const;

export const usernameSchema = z
  .string(required)
  .trim()
  .min(3, { error: "usernameTooShort" })
  .max(24, { error: "usernameTooLong" })
  .regex(/^[A-Za-z0-9_.]+$/, { error: "usernameInvalid" });

export const emailSchema = z
  .string(required)
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "emailInvalid" }).max(254, { error: "emailInvalid" }));

export const passwordSchema = z
  .string(required)
  .min(8, { error: "passwordTooShort" })
  .max(128, { error: "passwordTooLong" });

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  identifier: z.string(required).trim().min(1, required),
  password: z.string(required).min(1, required),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
  locale: z.enum(["vi", "en"]).default("vi"),
});

export const resetPasswordSchema = z.object({
  token: z.string(required).min(20, { error: "tokenInvalid" }),
  password: passwordSchema,
});

export const updateProfileSchema = z
  .object({ username: usernameSchema.optional(), email: emailSchema.optional() })
  .refine((value) => value.username != null || value.email != null, {
    error: "nothingToUpdate",
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string(required).min(1, required),
  newPassword: passwordSchema,
});

export const riotIdSchema = z.object({
  gameName: z
    .string(required)
    .trim()
    .min(3, { error: "gameNameInvalid" })
    .max(16, { error: "gameNameInvalid" })
    .refine((value) => !value.includes("#"), { error: "gameNameInvalid" }),
  tagLine: z
    .string(required)
    .trim()
    .regex(/^[\p{L}\p{N}]{3,5}$/u, { error: "tagLineInvalid" }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type RiotIdInput = z.infer<typeof riotIdSchema>;

export type FieldErrors = Partial<Record<string, AuthErrorCode>>;

const KNOWN_CODES = new Set<string>(AUTH_ERROR_CODES);

export function dropEmptyStrings(input: unknown): unknown {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return input;
  }
  return Object.fromEntries(
    Object.entries(input).filter(
      ([, value]) => !(typeof value === "string" && value.trim() === ""),
    ),
  );
}

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (errors[field] == null) {
      errors[field] = KNOWN_CODES.has(issue.message) ? (issue.message as AuthErrorCode) : "unknown";
    }
  }
  return errors;
}
