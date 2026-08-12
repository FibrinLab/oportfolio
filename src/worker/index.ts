import { getDb } from "@/server/db/client";
import {
  claimNext,
  markDone,
  markFailed,
  type OutboxPayloads,
} from "@/server/outbox/outbox";
import { handleSendEmail } from "./handlers/sendEmail";

// Background worker: polls the Postgres outbox with FOR UPDATE SKIP LOCKED.
// One modular monolith, two processes (`pnpm dev` + `pnpm worker`).

const POLL_INTERVAL_MS = 1000;

async function processOne(): Promise<boolean> {
  const db = getDb();
  const message = await claimNext(db);
  if (!message) return false;

  try {
    switch (message.topic) {
      case "send_email":
        await handleSendEmail(message.payload as OutboxPayloads["send_email"]);
        break;
      case "scan_attachment": {
        // Registered in the files phase; loaded lazily so the worker starts
        // without S3/clamd configuration during earlier phases.
        const { handleScanAttachment } = await import("./handlers/scanAttachment");
        await handleScanAttachment(message.payload as OutboxPayloads["scan_attachment"]);
        break;
      }
      default:
        throw new Error(`Unknown outbox topic: ${message.topic satisfies never}`);
    }
    await markDone(db, message.id);
  } catch (error) {
    const text = error instanceof Error ? `${error.message}` : String(error);
    console.error(`[worker] ${message.topic} ${message.id} failed (attempt ${message.attempts}): ${text}`);
    await markFailed(db, message.id, message.attempts, text);
  }
  return true;
}

async function main() {
  console.log("[worker] started");
  let running = true;
  const stop = () => {
    running = false;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (running) {
    try {
      const didWork = await processOne();
      if (!didWork) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (error) {
      console.error("[worker] poll error", error);
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS * 5));
    }
  }
  console.log("[worker] stopped");
  process.exit(0);
}

main();
