import axios from "axios";
import { getMessagesFor } from "@/i18n/messages";
import type { Mailer } from "./types";

export interface MailerConfig {
  resendApiKey?: string;
  from?: string;
  log?: (line: string) => void;
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

export function createMailer({ resendApiKey, from, log = console.info }: MailerConfig): Mailer {
  return {
    async sendPasswordReset({ to, link, locale }) {
      const subject = messageAt(locale, "auth.email.passwordReset.subject");
      const text = messageAt(locale, "auth.email.passwordReset.body", { link });

      if (!resendApiKey || !from) {
        log(`[mail] ${to} | ${subject} | ${link}`);
        return;
      }
      await axios.post(
        "https://api.resend.com/emails",
        { from, to, subject, text },
        { headers: { Authorization: `Bearer ${resendApiKey}` }, timeout: 15_000 },
      );
    },
  };
}
