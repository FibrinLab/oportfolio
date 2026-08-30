import { sendMail } from "@/server/mail/mailer";
import { renderTemplate } from "@/server/mail/templates";
import type { OutboxPayloads } from "@/server/outbox/outbox";

export async function handleSendEmail(
  payload: OutboxPayloads["send_email"],
  idempotencyKey?: string,
): Promise<void> {
  const rendered = renderTemplate(payload.template, payload.variables);
  if (!rendered) {
    throw new Error(`Unknown email template: ${payload.template}`);
  }
  await sendMail(payload.to, rendered.subject, rendered.text, idempotencyKey);
}
