import nodemailer from "nodemailer";
import { getMessagesFor } from "@/i18n/messages";
import { renderEmail } from "./email-template";
import type { Mailer } from "./types";

export interface MailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailTransport {
  sendMail(message: MailMessage): Promise<unknown>;
}

export interface MailerConfig {
  transport?: MailTransport;
  from?: string;
  log?: (line: string) => void;
}

export interface GmailCredentials {
  user?: string;
  appPassword?: string;
}

function messageAt(locale: "vi" | "en", path: string, values: Record<string, string> = {}): string {
  let node: unknown = getMessagesFor(locale);
  for (const segment of path.split(".")) {
    node =
      typeof node === "object" && node !== null
        ? (node as Record<string, unknown>)[segment]
        : undefined;
  }
  if (typeof node !== "string") {
    throw new Error(`Missing message ${path}`);
  }
  return node.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
}

export function createGmailTransport({
  user,
  appPassword,
}: GmailCredentials): MailTransport | undefined {
  if (!user || !appPassword) {
    return undefined;
  }
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass: appPassword.replace(/\s+/g, "") },
  });
}

export function createMailer({ transport, from, log = console.info }: MailerConfig): Mailer {
  return {
    async sendPasswordReset({ to, username, link, locale }) {
      const message = (key: string) =>
        messageAt(locale, `auth.email.passwordReset.${key}`, { username });
      const subject = message("subject");
      const [greeting, intro, expiry, ignore] = ["greeting", "intro", "expiry", "ignore"].map(
        message,
      ) as [string, string, string, string];
      const paragraphs = [greeting, intro, expiry, ignore];
      const text = [greeting, intro, link, expiry, ignore, message("footer")].join("\n\n");
      const html = renderEmail({
        locale,
        preheader: message("preheader"),
        heading: message("heading"),
        paragraphs,
        button: { label: message("button"), href: link },
        fallback: message("fallback"),
        footer: message("footer"),
      });

      if (!transport || !from) {
        log(`[mail] ${to} | ${subject} | ${link}`);
        return;
      }
      await transport.sendMail({ from, to, subject, text, html });
    },
  };
}
