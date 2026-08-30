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

async function sendWithResendApi(
  to: string,
  subject: string,
  text: string,
  idempotencyKey?: string,
): Promise<void> {
  const env = getEnv();
  if (!env.SMTP_PASS) {
    throw new Error("Resend API key is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SMTP_PASS}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: env.SMTP_FROM,
      to: [to],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    // Keep provider details server-side and bounded. Resend errors do not
    // include the API key, but avoid logging an arbitrarily large body.
    const detail = (await response.text()).slice(0, 1_000);
    throw new Error(`Resend API returned ${response.status}: ${detail}`);
  }
}

export async function sendMail(
  to: string,
  subject: string,
  text: string,
  idempotencyKey?: string,
): Promise<void> {
  const env = getEnv();

  // Resend recommends its HTTPS API for Cloudflare Workers. The existing
  // SMTP password is the Resend API key, so production needs no new secret.
  if (env.SMTP_HOST.toLowerCase() === "smtp.resend.com") {
    await sendWithResendApi(to, subject, text, idempotencyKey);
    return;
  }

  await getTransport().sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text,
    ...(idempotencyKey
      ? { headers: { "Resend-Idempotency-Key": idempotencyKey } }
      : {}),
  });
}
