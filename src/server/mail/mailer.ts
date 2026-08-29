import nodemailer from "nodemailer";
import { getEnv } from "@/server/config/env";

// Outbound mail carries sign-in and invitation links, so the SMTP hop must
// be authenticated and encrypted in production: either implicit TLS
// (SMTP_SECURE=true, usually port 465) or mandatory STARTTLS
// (SMTP_REQUIRE_TLS, defaulting to true in production). Mailpit locally
// needs neither.

const globalForMail = globalThis as unknown as {
  mailTransport?: nodemailer.Transporter;
};

export function getTransport(): nodemailer.Transporter {
  if (!globalForMail.mailTransport) {
    const env = getEnv();
    globalForMail.mailTransport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      requireTLS: !env.SMTP_SECURE && env.smtpRequireTls,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? "" } : undefined,
      // Fail fast rather than hold outbox rows open on a dead relay.
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
  }
  return globalForMail.mailTransport;
}

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  await getTransport().sendMail({
    from: getEnv().SMTP_FROM,
    to,
    subject,
    text,
  });
}
