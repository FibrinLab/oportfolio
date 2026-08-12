import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { tenant } from "./identity";

export const actorType = pgEnum("actor_type", ["user", "system", "worker"]);
export const auditOutcome = pgEnum("audit_outcome", ["success", "denied", "failure"]);

// Append-only, hash-chained per tenant (spec/05). The migration adds a
// trigger raising on UPDATE/DELETE plus REVOKE for the app role. Metadata
// stores changed field names and identifiers — never narrative or secrets.
export const auditEvent = pgTable(
  "audit_event",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    actorUserId: uuid("actor_user_id"),
    actorType: actorType("actor_type").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id"),
    enrolmentId: uuid("enrolment_id"),
    requestId: text("request_id"),
    sourceContext: text("source_context"),
    outcome: auditOutcome("outcome").notNull(),
    reasonCode: text("reason_code"),
    metadataJson: jsonb("metadata_json"),
    previousEventHash: text("previous_event_hash").notNull(),
    eventHash: text("event_hash").notNull(),
  },
  (t) => [
    index("audit_event_tenant_time_idx").on(t.tenantId, t.occurredAt),
    index("audit_event_target_idx").on(t.tenantId, t.targetType, t.targetId),
  ],
);

// Durable outbox: rows are written in the same transaction as the mutation
// they follow from (NFR-S-004); the worker claims with FOR UPDATE SKIP LOCKED.
export const outboxMessage = pgTable(
  "outbox_message",
  {
    id: uuid("id").primaryKey(),
    topic: text("topic").notNull(),
    payloadJson: jsonb("payload_json").notNull(),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lastError: text("last_error"),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("outbox_pending_idx").on(t.runAfter).where(sql`${t.doneAt} IS NULL`),
  ],
);

export const idempotencyKey = pgTable(
  "idempotency_key",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.key] })],
);
