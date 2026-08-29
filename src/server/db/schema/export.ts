import { sql } from "drizzle-orm";
import {
  bigint,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { appUser, tenant } from "./identity";
import { enrolment } from "./programme";

export const exportKind = pgEnum("export_kind", ["standard", "final"]);
export const exportStatus = pgEnum("export_status", [
  "queued",
  "processing",
  "ready",
  "failed",
  "superseded",
  "expired",
]);

export const exportJob = pgTable(
  "export_job",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    enrolmentId: uuid("enrolment_id").notNull(),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => appUser.id),
    kind: exportKind("kind").notNull().default("standard"),
    status: exportStatus("status").notNull().default("queued"),
    finishCycle: integer("finish_cycle"),
    // A point-in-time copy of retained diary data. The outbox carries only
    // this job id so narrative text never appears in logs or queue payloads.
    snapshotJson: jsonb("snapshot_json").notNull(),
    objectKey: text("object_key"),
    archiveSha256: text("archive_sha256"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    failureCode: text("failure_code"),
    failureDetail: text("failure_detail"),
    artifactExpiresAt: timestamp("artifact_expires_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    downloadedAt: timestamp("downloaded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "export_job_enrolment_tenant_fk",
      columns: [t.enrolmentId, t.tenantId],
      foreignColumns: [enrolment.id, enrolment.tenantId],
    }),
    index("export_job_owner_idx").on(t.enrolmentId, t.requestedBy, t.createdAt),
    index("export_job_pending_idx").on(t.status, t.createdAt),
  ],
);

export const retentionHold = pgTable(
  "retention_hold",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    enrolmentId: uuid("enrolment_id").notNull(),
    reason: text("reason").notNull(),
    placedBy: uuid("placed_by")
      .notNull()
      .references(() => appUser.id),
    placedAt: timestamp("placed_at", { withTimezone: true }).notNull().defaultNow(),
    releasedBy: uuid("released_by").references(() => appUser.id),
    releasedAt: timestamp("released_at", { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      name: "retention_hold_enrolment_tenant_fk",
      columns: [t.enrolmentId, t.tenantId],
      foreignColumns: [enrolment.id, enrolment.tenantId],
    }),
    uniqueIndex("retention_hold_active_unique")
      .on(t.enrolmentId)
      .where(sql`${t.releasedAt} IS NULL`),
    index("retention_hold_enrolment_idx").on(t.enrolmentId),
  ],
);
