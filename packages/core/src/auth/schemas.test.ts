import { expect, test } from "@playwright/test";
import {
  changePasswordSchema,
  dropEmptyStrings,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  riotIdSchema,
  toFieldErrors,
  updateProfileSchema,
} from "./schemas";

const errorsOf = (result: { success: boolean; error?: Parameters<typeof toFieldErrors>[0] }) =>
  result.success || !result.error ? {} : toFieldErrors(result.error);

test.describe("registerSchema", () => {
  test("accepts and normalizes a valid account", () => {
    const result = registerSchema.parse({
      username: " qudu_18 ",
      email: " Qudu@Example.COM ",
      password: "matkhau-an-toan",
    });
    expect(result).toEqual({
      username: "qudu_18",
      email: "qudu@example.com",
      password: "matkhau-an-toan",
    });
  });

  test("reports one error code per field", () => {
    const result = registerSchema.safeParse({ username: "a!", email: "nope", password: "short" });
    expect(errorsOf(result)).toEqual({
      username: "usernameTooShort",
      email: "emailInvalid",
      password: "passwordTooShort",
    });
  });

  test("rejects characters outside the username alphabet", () => {
    const result = registerSchema.safeParse({
      username: "tên có dấu",
      email: "a@b.vn",
      password: "12345678",
    });
    expect(errorsOf(result).username).toBe("usernameInvalid");
  });

  test("treats missing fields as required", () => {
    expect(errorsOf(registerSchema.safeParse({}))).toEqual({
      username: "required",
      email: "required",
      password: "required",
    });
  });
});

test.describe("dropEmptyStrings", () => {
  test("turns blank form fields into missing fields", () => {
    expect(dropEmptyStrings({ username: "", email: "  ", password: "x", keep: 0 })).toEqual({
      password: "x",
      keep: 0,
    });
    expect(
      errorsOf(registerSchema.safeParse(dropEmptyStrings({ username: "", email: "" }))),
    ).toMatchObject({
      username: "required",
      email: "required",
    });
  });

  test("leaves non objects alone", () => {
    expect(dropEmptyStrings("text")).toBe("text");
    expect(dropEmptyStrings(null)).toBeNull();
  });
});

test.describe("other schemas", () => {
  test("login needs both fields", () => {
    expect(errorsOf(loginSchema.safeParse({ identifier: " ", password: "" }))).toEqual({
      identifier: "required",
      password: "required",
    });
  });

  test("forgot password defaults to Vietnamese", () => {
    expect(forgotPasswordSchema.parse({ email: "a@b.vn" }).locale).toBe("vi");
  });

  test("profile update needs at least one field", () => {
    expect(errorsOf(updateProfileSchema.safeParse({}))).toEqual({ form: "nothingToUpdate" });
    expect(updateProfileSchema.safeParse({ email: "x@y.vn" }).success).toBe(true);
  });

  test("change password validates the new password", () => {
    const result = changePasswordSchema.safeParse({ currentPassword: "old", newPassword: "1" });
    expect(errorsOf(result)).toEqual({ newPassword: "passwordTooShort" });
  });

  test("riot id accepts Vietnamese game names and short tags", () => {
    expect(riotIdSchema.safeParse({ gameName: "Quý Đức", tagLine: "VN2" }).success).toBe(true);
    expect(errorsOf(riotIdSchema.safeParse({ gameName: "a#b", tagLine: "toolong" }))).toEqual({
      gameName: "gameNameInvalid",
      tagLine: "tagLineInvalid",
    });
  });
});
