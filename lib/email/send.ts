// Sends email through Gmail SMTP with the app password in GMAIL_USER /
// GMAIL_APP_PASSWORD (D-070). Spec 7.5: up to 3 attempts with back-off.
import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
};

export type SendResult = { status: "sent" | "failed"; attempts: number; error?: string };

const RETRY_DELAYS_MS = [0, 1000, 3000];

let transport: Transporter | null = null;

function getTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  if (!user || !pass) return null;
  transport ??= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  return transport;
}

export function emailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  const mailer = getTransport();
  if (!mailer) return { status: "failed", attempts: 0, error: "email not configured" };
  let lastError = "";
  for (let i = 0; i < RETRY_DELAYS_MS.length; i++) {
    if (RETRY_DELAYS_MS[i]) await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[i]));
    try {
      await mailer.sendMail({
        from: { name: "KD Pops (BakeBot)", address: process.env.GMAIL_USER! },
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        attachments: email.attachments,
      });
      return { status: "sent", attempts: i + 1 };
    } catch (error) {
      lastError = error instanceof Error ? error.message.slice(0, 200) : "send failed";
      // Wrong password or blocked account: retrying will not help.
      if (/Invalid login|Username and Password not accepted|535/i.test(lastError)) {
        return { status: "failed", attempts: i + 1, error: lastError };
      }
    }
  }
  return { status: "failed", attempts: RETRY_DELAYS_MS.length, error: lastError };
}
