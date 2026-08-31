import { getDb } from "@/server/db/client";
import {
  claimNextForTopic,
  markDone,
  markFailed,
  type OutboxPayloads,
} from "@/server/outbox/outbox";
import { handleScanAttachment } from "./handlers/scanAttachment";

async function processOneAttachment(): Promise<boolean> {
  const db = getDb();
  const message = await claimNextForTopic(db, "scan_attachment");
  if (!message) return false;

  try {
    await handleScanAttachment(message.payload as OutboxPayloads["scan_attachment"]);
    await markDone(db, message.id);
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    console.error(
      `[worker] scan_attachment ${message.id} failed (attempt ${message.attempts}): ${text}`,
    );
    await markFailed(db, message.id, message.attempts, text);
  }
  return true;
}

export async function processAttachmentOutboxBatch(maxMessages = 20): Promise<number> {
  let processed = 0;
  while (processed < maxMessages && (await processOneAttachment())) {
    processed += 1;
  }
  return processed;
}
