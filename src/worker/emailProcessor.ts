import { getDb } from "@/server/db/client";
import {
  claimNextForTopic,
  markDone,
  markFailed,
  type OutboxPayloads,
} from "@/server/outbox/outbox";
import { handleSendEmail } from "./handlers/sendEmail";

async function processOneEmail(): Promise<boolean> {
  const db = getDb();
  const message = await claimNextForTopic(db, "send_email");
  if (!message) return false;

  try {
    await handleSendEmail(
      message.payload as OutboxPayloads["send_email"],
      `outbox/${message.id}`,
    );
    await markDone(db, message.id);
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    console.error(`[worker] send_email ${message.id} failed (attempt ${message.attempts}): ${text}`);
    await markFailed(db, message.id, message.attempts, text);
  }
  return true;
}

export async function processEmailOutboxBatch(maxMessages = 20): Promise<number> {
  let processed = 0;
  while (processed < maxMessages && (await processOneEmail())) {
    processed += 1;
  }
  return processed;
}
