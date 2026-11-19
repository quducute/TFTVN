import { C } from "@/theme/colors.js";

export interface EmailContent {
  locale: "vi" | "en";
  preheader: string;
  heading: string;
  paragraphs: string[];
  button: { label: string; href: string };
  fallback: string;
  footer: string;
}

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replaceAll(/[&<>"']/g, (character) => ENTITIES[character]!);
}

const FONT = "'Be Vietnam Pro', 'Segoe UI', Arial, sans-serif";

export function renderEmail(content: EmailContent): string {
  const href = escapeHtml(content.button.href);
  const paragraphs = content.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:${C.text};">${escapeHtml(paragraph)}</p>`,
    )
    .join("");

  return [
    "<!doctype html>",
    `<html lang="${content.locale}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="dark">',
    `<title>${escapeHtml(content.heading)}</title>`,
    "</head>",
    `<body style="margin:0;padding:0;background-color:${C.bg};">`,
    `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(content.preheader)}</div>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.bg};">`,
    '<tr><td align="center" style="padding:32px 16px;">',
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;font-family:${FONT};">`,
    `<tr><td style="padding:0 0 24px;font-size:24px;font-weight:700;color:${C.text};">TFT<span style="color:${C.primary};">VN</span></td></tr>`,
    `<tr><td style="padding:32px;border:1px solid ${C.emailBorder};border-radius:12px;background-color:${C.bg};">`,
    `<h1 style="margin:0 0 20px;font-size:22px;line-height:30px;color:${C.primary};">${escapeHtml(content.heading)}</h1>`,
    paragraphs,
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">',
    `<tr><td style="border-radius:8px;background-color:${C.primary};">`,
    `<a href="${href}" target="_blank" style="display:inline-block;padding:12px 24px;font-size:16px;font-weight:700;color:${C.onPrimary};text-decoration:none;border-radius:8px;">${escapeHtml(content.button.label)}</a>`,
    "</td></tr>",
    "</table>",
    `<p style="margin:0 0 8px;font-size:13px;line-height:20px;color:${C.muted};">${escapeHtml(content.fallback)}</p>`,
    `<p style="margin:0;font-size:13px;line-height:20px;word-break:break-all;"><a href="${href}" target="_blank" style="color:${C.primary};">${href}</a></p>`,
    "</td></tr>",
    `<tr><td style="padding:24px 0 0;font-size:12px;line-height:18px;color:${C.muted};">${escapeHtml(content.footer)}</td></tr>`,
    "</table>",
    "</td></tr>",
    "</table>",
    "</body>",
    "</html>",
  ].join("");
}
