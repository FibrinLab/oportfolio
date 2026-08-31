import { getDb } from "@/server/db/client";
import {
  claimNext,
  markDone,
  markFailed,
  type OutboxPayloads,
} from "@/server/outbox/outbox";
import { handleSendEmail } from "./handlers/sendEmail";

export async function processOne(): Promise<boolean> {
  const db = getDb();
  const message = await claimNext(db);
  if (!message) return false;

  try {
    switch (message.topic) {
      case "send_email":
        await handleSendEmail(
          message.payload as OutboxPayloads["send_email"],
          `outbox/${message.id}`,
        );
        break;
      case "scan_attachment": {
        const { handleScanAttachment } = await import("./handlers/scanAttachment");
        await handleScanAttachment(message.payload as OutboxPayloads["scan_attachment"]);
        break;
      }
      case "generate_diary_export": {
        const { handleGenerateDiaryExport } = await import("./handlers/diaryExport");
        await handleGenerateDiaryExport(
          message.payload as OutboxPayloads["generate_diary_export"],
        );
        break;
      }
      case "expire_diary_export": {
        const { handleExpireDiaryExport } = await import("./handlers/diaryExport");
        await handleExpireDiaryExport(
          message.payload as OutboxPayloads["expire_diary_export"],
        );
        break;
      }
      case "diary_reminder": {
        const { handleDiaryReminder } = await import("./handlers/diaryLifecycle");
        await handleDiaryReminder(message.payload as OutboxPayloads["diary_reminder"]);
        break;
      }
      case "purge_diary": {
        const { handlePurgeDiary } = await import("./handlers/diaryLifecycle");
        await handlePurgeDiary(message.payload as OutboxPayloads["purge_diary"]);
        break;
      }
      default:
        throw new Error(`Unknown outbox topic: ${message.topic satisfies never}`);
    }
    await markDone(db, message.id);
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    console.error(`[worker] ${message.topic} ${message.id} failed (attempt ${message.attempts}): ${text}`);
    await markFailed(db, message.id, message.attempts, text);
  }
  return true;
}

export async function processOutboxBatch(maxMessages = 20): Promise<number> {
  let processed = 0;
  while (processed < maxMessages && (await processOne())) {
    processed += 1;
  }
  return processed;
}
