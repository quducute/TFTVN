import { expect, test } from "@playwright/test";
import { escapeHtml, renderEmail } from "./email-template";

const content = {
  locale: "vi" as const,
  preheader: "Xem trước",
  heading: "Đặt lại mật khẩu",
  paragraphs: ["Xin chào <script>alert(1)</script>,", "Đoạn hai"],
  button: { label: "Bấm vào đây", href: 'https://tftvn.vn/reset?token=a&b="c"' },
  fallback: "Sao chép link:",
  footer: "TFTVN",
};

test("escapes every piece of text and the link", () => {
  const html = renderEmail(content);
  expect(html).not.toContain("<script>");
  expect(html).toContain("Xin chào &lt;script&gt;alert(1)&lt;/script&gt;,");
  expect(html).toContain('href="https://tftvn.vn/reset?token=a&amp;b=&quot;c&quot;"');
  expect(escapeHtml(`'&'`)).toBe("&#39;&amp;&#39;");
});

test("uses the site theme colors from colors.js", () => {
  const html = renderEmail(content);
  expect(html).toContain("background-color:black");
  expect(html).toContain("background-color:gold");
  expect(html).not.toMatch(/#[0-9a-f]{3,6}\b/i);
});

test("keeps the preheader hidden and the button label visible", () => {
  const html = renderEmail(content);
  expect(html).toContain('<div style="display:none;max-height:0;overflow:hidden;">Xem trước</div>');
  expect(html).toContain(">Bấm vào đây</a>");
});
