import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { Db } from "@/server/db/client";
import { outboxMessage } from "@/server/db/schema";

// Durable queue: messages are enqueued in the same transaction as the state
// change that requires them (NFR-S-004, NFR-A-004); the worker claims with
// FOR UPDATE SKIP LOCKED and marks done or retries with backoff.

export type OutboxTopic = "send_email" | "scan_attachment";

export interface OutboxPayloads {
  send_email: {
    to: string;
    template: string;
    // Neutral variables only — no narrative or portfolio content (spec/07).
    variables: Record<string, string>;
  };
  scan_attachment: {
    attachmentId: string;
    tenantId: string;
  };
}

export async function enqueue<T extends OutboxTopic>(
  tx: Db,
  topic: T,
  payload: OutboxPayloads[T],
  runAfter?: Date,
): Promise<string> {
  const id = uuidv7();
  await tx.insert(outboxMessage).values({
    id,
    topic,
    payloadJson: payload,
    runAfter: runAfter ?? new Date(),
  });
  return id;
}

export interface ClaimedMessage {
  id: string;
  topic: OutboxTopic;
  payload: unknown;
  attempts: number;
}

const MAX_ATTEMPTS = 8;

export async function claimNext(db: Db): Promise<ClaimedMessage | null> {
  const result = await db.execute(sql`
    UPDATE outbox_message SET locked_at = now(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM outbox_message
      WHERE done_at IS NULL
        AND run_after <= now()
        AND attempts < ${MAX_ATTEMPTS}
        AND (locked_at IS NULL OR locked_at < now() - interval '5 minutes')
      ORDER BY run_after
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, topic, payload_json, attempts
  `);
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id as string,
    topic: row.topic as OutboxTopic,
    payload: row.payload_json,
    attempts: row.attempts as number,
  };
}

export async function markDone(db: Db, id: string): Promise<void> {
  await db.execute(sql`UPDATE outbox_message SET done_at = now(), last_error = NULL WHERE id = ${id}`);
}

export async function markFailed(db: Db, id: string, attempts: number, error: string): Promise<void> {
  // Exponential backoff: 30s, 60s, 2m, 4m, ... capped at ~30m.
  const delaySeconds = Math.min(30 * 2 ** (attempts - 1), 1800);
  await db.execute(sql`
    UPDATE outbox_message
    SET locked_at = NULL,
        last_error = ${error.slice(0, 2000)},
        run_after = now() + make_interval(secs => ${delaySeconds})
    WHERE id = ${id}
  `);
}
