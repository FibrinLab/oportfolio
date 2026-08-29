import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { mutableColumns } from "./common";
import { appUser, tenant } from "./identity";
import { duty, enrolment } from "./programme";
import { objective } from "./framework";

export const visibility = pgEnum("visibility", ["private", "supervisors", "faculty"]);
export const evidenceWorkflowState = pgEnum("evidence_workflow_state", [
  "draft",
  "shared",
  "review_requested",
]);
export const scanStatus = pgEnum("scan_status", [
  "awaiting_upload",
  "pending_scan",
  "clean",
  "rejected",
  "quarantined",
  // Encrypted in the browser before upload (ADR-007): integrity-checked and
  // stored, but not scannable server-side. Only the author can open it.
  "sealed",
]);
export const linkType = pgEnum("link_type", [
  "general",
  "repository",
  "commit",
  "pull_request",
  "release",
  "notebook",
  "other",
]);

export const evidenceType = pgTable(
  "evidence_type",
  {
    id: uuid("id").primaryKey(),
    // Nullable: the eight canonical types are global; tenants add their own.
    tenantId: uuid("tenant_id").references(() => tenant.id),
    stableCode: text("stable_code").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    canonical: boolean("canonical").notNull().default(false),
    active: boolean("active").notNull().default(true),
    fieldsSchemaJson: jsonb("fields_schema_json"),
    ...mutableColumns,
  },
  (t) => [
    uniqueIndex("evidence_type_code_unique").on(
      sql`coalesce(${t.tenantId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      t.stableCode,
    ),
  ],
);

export const provenanceType = pgTable(
  "provenance_type",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenant.id),
    stableCode: text("stable_code").notNull(),
    label: text("label").notNull(),
    canonical: boolean("canonical").notNull().default(false),
    active: boolean("active").notNull().default(true),
    ...mutableColumns,
  },
  (t) => [
    uniqueIndex("provenance_type_code_unique").on(
      sql`coalesce(${t.tenantId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      t.stableCode,
    ),
  ],
);

export const evidenceItem = pgTable(
  "evidence_item",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    enrolmentId: uuid("enrolment_id").notNull(),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => appUser.id),
    title: text("title").notNull(),
    activityDate: date("activity_date"),
    activityEndedOn: date("activity_ended_on"),
    evidenceTypeId: uuid("evidence_type_id").references(() => evidenceType.id),
    // Restricted portable rich-text document (canonical storage).
    narrativeDoc: jsonb("narrative_doc").notNull(),
    // Plain-text extraction for authorised search only.
    narrativeText: text("narrative_text").notNull().default(""),
    // End-to-end encryption (ADR-007): when `encrypted`, title and narrative
    // live only in `content_enc` ({ title: Envelope, narrative: Envelope })
    // and the plaintext columns are empty — enforced by a CHECK constraint.
    encrypted: boolean("encrypted").notNull().default(false),
    contentEnc: jsonb("content_enc"),
    // Type-specific structured fields (spec/06 per-type table).
    typeFieldsJson: jsonb("type_fields_json"),
    provenanceId: uuid("provenance_id").references(() => provenanceType.id),
    visibility: visibility("visibility").notNull().default("private"),
    workflowState: evidenceWorkflowState("workflow_state").notNull().default("draft"),
    reviewRequestedAt: timestamp("review_requested_at", { withTimezone: true }),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletionDueAt: timestamp("deletion_due_at", { withTimezone: true }),
    currentRevisionId: uuid("current_revision_id"),
    ...mutableColumns,
  },
  (t) => [
    unique("evidence_item_id_tenant_unique").on(t.id, t.tenantId),
    foreignKey({
      name: "evidence_item_enrolment_tenant_fk",
      columns: [t.enrolmentId, t.tenantId],
      foreignColumns: [enrolment.id, enrolment.tenantId],
    }),
    // Partial index for the live log list (spec/05 index guidance).
    index("evidence_item_enrolment_live_idx")
      .on(t.enrolmentId, t.activityDate)
      .where(sql`${t.deletedAt} IS NULL`),
    index("evidence_item_author_idx").on(t.authorUserId),
    check(
      "evidence_item_private_only_check",
      sql`${t.visibility} = 'private' AND ${t.workflowState} = 'draft'`,
    ),
    check(
      "evidence_item_encrypted_no_plaintext_check",
      sql`NOT ${t.encrypted} OR (${t.title} = '' AND ${t.narrativeText} = '' AND ${t.contentEnc} IS NOT NULL)`,
    ),
  ],
);

// Append-only revision snapshots (spec/05). A trigger rejects UPDATE/DELETE.
export const evidenceRevision = pgTable(
  "evidence_revision",
  {
    id: uuid("id").primaryKey(),
    evidenceItemId: uuid("evidence_item_id")
      .notNull()
      .references(() => evidenceItem.id),
    revisionNumber: integer("revision_number").notNull(),
    snapshotJson: jsonb("snapshot_json").notNull(),
    changedFields: jsonb("changed_fields"),
    changeReason: text("change_reason"),
    contentSha256: text("content_sha256").notNull(),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("evidence_revision_item_number_unique").on(t.evidenceItemId, t.revisionNumber),
  ],
);

export const evidenceObjective = pgTable(
  "evidence_objective",
  {
    id: uuid("id").primaryKey(),
    evidenceItemId: uuid("evidence_item_id")
      .notNull()
      .references(() => evidenceItem.id),
    objectiveId: uuid("objective_id")
      .notNull()
      .references(() => objective.id),
    mappingNote: text("mapping_note"),
    mappedBy: uuid("mapped_by").notNull(),
    mappedAt: timestamp("mapped_at", { withTimezone: true }).notNull().defaultNow(),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    enrolmentMigrationId: uuid("enrolment_migration_id"),
  },
  (t) => [
    // Unique active pair (spec/05).
    uniqueIndex("evidence_objective_active_unique")
      .on(t.evidenceItemId, t.objectiveId)
      .where(sql`${t.validTo} IS NULL`),
    index("evidence_objective_objective_idx").on(t.objectiveId).where(sql`${t.validTo} IS NULL`),
  ],
);

export const evidenceDuty = pgTable(
  "evidence_duty",
  {
    id: uuid("id").primaryKey(),
    evidenceItemId: uuid("evidence_item_id")
      .notNull()
      .references(() => evidenceItem.id),
    dutyId: uuid("duty_id")
      .notNull()
      .references(() => duty.id),
    taggedBy: uuid("tagged_by").notNull(),
    taggedAt: timestamp("tagged_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("evidence_duty_unique").on(t.evidenceItemId, t.dutyId)],
);

// Minimal PDP tables (Milestone 1 carries the mapping capability at the data
// layer; PDP workflows are Milestone 2).
export const pdp = pgTable(
  "pdp",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    enrolmentId: uuid("enrolment_id").notNull(),
    status: text("status").notNull().default("draft"),
    currentRevisionId: uuid("current_revision_id"),
    ...mutableColumns,
  },
  (t) => [
    uniqueIndex("pdp_enrolment_unique").on(t.enrolmentId),
    foreignKey({
      name: "pdp_enrolment_tenant_fk",
      columns: [t.enrolmentId, t.tenantId],
      foreignColumns: [enrolment.id, enrolment.tenantId],
    }),
  ],
);

export const pdpGoal = pgTable(
  "pdp_goal",
  {
    id: uuid("id").primaryKey(),
    pdpId: uuid("pdp_id")
      .notNull()
      .references(() => pdp.id),
    title: text("title").notNull(),
    status: text("status").notNull().default("not_started"),
    targetDate: date("target_date"),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...mutableColumns,
  },
  (t) => [index("pdp_goal_pdp_idx").on(t.pdpId)],
);

export const evidenceGoal = pgTable(
  "evidence_goal",
  {
    id: uuid("id").primaryKey(),
    evidenceItemId: uuid("evidence_item_id")
      .notNull()
      .references(() => evidenceItem.id),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => pdpGoal.id),
    linkedBy: uuid("linked_by").notNull(),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("evidence_goal_unique").on(t.evidenceItemId, t.goalId)],
);

export const attachment = pgTable(
  "attachment",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    // Explicit parent allowlist (spec/05); evidence_item only in M1.
    parentType: text("parent_type").notNull().default("evidence_item"),
    parentId: uuid("parent_id").notNull(),
    objectKey: text("object_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    displayName: text("display_name").notNull(),
    mediaTypeClaimed: text("media_type_claimed").notNull(),
    mediaTypeDetected: text("media_type_detected"),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: text("sha256"),
    scanStatus: scanStatus("scan_status").notNull().default("awaiting_upload"),
    scanEngineVersion: text("scan_engine_version"),
    scanCompletedAt: timestamp("scan_completed_at", { withTimezone: true }),
    previewKey: text("preview_key"),
    // Sealed in the browser (ADR-007): bytes are an OPE1 container, the real
    // filename and media type live only in `name_enc`.
    encrypted: boolean("encrypted").notNull().default(false),
    nameEnc: jsonb("name_enc"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...mutableColumns,
  },
  (t) => [
    uniqueIndex("attachment_object_key_unique").on(t.objectKey),
    index("attachment_parent_idx").on(t.parentType, t.parentId).where(sql`${t.deletedAt} IS NULL`),
    check(
      "attachment_encrypted_no_plaintext_check",
      sql`NOT ${t.encrypted} OR (${t.displayName} = 'sealed' AND ${t.originalFilename} = 'sealed' AND ${t.nameEnc} IS NOT NULL)`,
    ),
  ],
);

export const externalLink = pgTable(
  "external_link",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    evidenceItemId: uuid("evidence_item_id")
      .notNull()
      .references(() => evidenceItem.id),
    linkType: linkType("link_type").notNull().default("general"),
    url: text("url").notNull(),
    host: text("host").notNull(),
    label: text("label"),
    description: text("description"),
    // Code artefact metadata (spec/06): revision/SHA, contribution, access.
    capturedMetadataJson: jsonb("captured_metadata_json"),
    // Sealed in the browser (ADR-007): url/host/label live only in `link_enc`.
    encrypted: boolean("encrypted").notNull().default(false),
    linkEnc: jsonb("link_enc"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...mutableColumns,
  },
  (t) => [
    index("external_link_item_idx").on(t.evidenceItemId).where(sql`${t.deletedAt} IS NULL`),
    check(
      "external_link_encrypted_no_plaintext_check",
      sql`NOT ${t.encrypted} OR (${t.url} = '' AND ${t.host} = '' AND ${t.label} IS NULL AND ${t.description} IS NULL AND ${t.linkEnc} IS NOT NULL)`,
    ),
  ],
);
