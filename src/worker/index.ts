import { sql } from "drizzle-orm";
import { getEnv } from "@/server/config/env";
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
const HOUSEKEEPING_INTERVAL_MS = 60 * 60 * 1000;

// Data minimisation for the auth tables (spec/12): spent or expired tokens
// and revoked sessions carry no value once their window has passed, and the
// rate-limit table grows with every distinct email/IP. Audit rows are never
// touched here — they are append-only by design.
async function housekeeping(): Promise<void> {
  const db = getDb();
  await db.execute(sql`DELETE FROM login_rate WHERE window_started_at < now() - interval '1 day'`);
  await db.execute(sql`
    DELETE FROM magic_link_token
    WHERE (used_at IS NOT NULL OR expires_at < now()) AND created_at < now() - interval '7 days'
  `);
  await db.execute(sql`
    DELETE FROM auth_session
    WHERE (revoked_at IS NOT NULL OR absolute_expires_at < now())
      AND coalesce(revoked_at, absolute_expires_at) < now() - interval '30 days'
  `);
}

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
    const text = error instanceof Error ? `${error.message}` : String(error);
    console.error(`[worker] ${message.topic} ${message.id} failed (attempt ${message.attempts}): ${text}`);
    await markFailed(db, message.id, message.attempts, text);
  }
  return true;
}

async function main() {
  // Fail fast on a misconfigured deployment (same checks as the web app).
  getEnv();
  console.log("[worker] started");
  let running = true;
  let lastHousekeeping = 0;
  const stop = () => {
    running = false;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (running) {
    try {
      if (Date.now() - lastHousekeeping > HOUSEKEEPING_INTERVAL_MS) {
        lastHousekeeping = Date.now();
        await housekeeping();
      }
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
