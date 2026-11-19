import { expect, test } from "@playwright/test";
import { type MailMessage, createGmailTransport, createMailer } from "./mailer";

const LINK = "https://tftvn.vn/reset-password?token=abc";

test.describe("mailer", () => {
  test("sends a localized reset email through the transport", async () => {
    const sent: MailMessage[] = [];
    const mailer = createMailer({
      transport: { sendMail: async (message) => sent.push(message) },
      from: "TFTVN <tftvn@gmail.com>",
    });

    await mailer.sendPasswordReset({ to: "a@b.vn", username: "qudu", link: LINK, locale: "vi" });
    await mailer.sendPasswordReset({ to: "c@d.vn", username: "qudu", link: LINK, locale: "en" });

    expect(sent[0]).toMatchObject({
      from: "TFTVN <tftvn@gmail.com>",
      to: "a@b.vn",
      subject: "Đặt lại mật khẩu TFTVN",
    });
    expect(sent[0]!.text).toContain(LINK);
    expect(sent[0]!.text).toContain("30 phút");
    expect(sent[0]!.text).toContain("Xin chào qudu,");
    expect(sent[0]!.html).toContain(`href="${LINK}"`);
    expect(sent[0]!.html).toContain("Đặt mật khẩu mới");
    expect(sent[0]!.html).toContain('<html lang="vi">');
    expect(sent[1]!.html).toContain("Choose a new password");
    expect(sent[1]).toMatchObject({ to: "c@d.vn", subject: "Reset your TFTVN password" });
  });

  test("logs the link instead of sending when no transport is configured", async () => {
    const lines: string[] = [];
    const mailer = createMailer({ log: (line) => lines.push(line) });
    await mailer.sendPasswordReset({ to: "a@b.vn", username: "qudu", link: LINK, locale: "vi" });
    expect(lines).toEqual([`[mail] a@b.vn | Đặt lại mật khẩu TFTVN | ${LINK}`]);
  });

  test("builds a Gmail transport only when both credentials exist", () => {
    expect(createGmailTransport({ user: "tftvn@gmail.com" })).toBeUndefined();
    expect(createGmailTransport({ appPassword: "abcd efgh ijkl mnop" })).toBeUndefined();
    expect(
      createGmailTransport({ user: "tftvn@gmail.com", appPassword: "abcd efgh ijkl mnop" }),
    ).toBeDefined();
  });
});
