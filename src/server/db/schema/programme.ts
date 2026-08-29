import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
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

export const programmeStatus = pgEnum("programme_status", ["active", "archived"]);
export const cohortStatus = pgEnum("cohort_status", ["planned", "active", "closed"]);
export const enrolmentStatus = pgEnum("enrolment_status", [
  "provisional",
  "active",
  "paused",
  "completed",
  "withdrawn",
]);
export const assignmentType = pgEnum("assignment_type", ["primary", "co_supervisor"]);
export const diaryState = pgEnum("diary_state", ["open", "finished", "purged"]);

export const programme = pgTable(
  "programme",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: programmeStatus("status").notNull().default("active"),
    defaultDurationMonths: integer("default_duration_months"),
    defaultFte: numeric("default_fte"),
    ...mutableColumns,
  },
  (t) => [
    uniqueIndex("programme_tenant_code_unique").on(t.tenantId, t.code),
    // Parent side of composite tenant FKs (invariant 1).
    unique("programme_id_tenant_unique").on(t.id, t.tenantId),
  ],
);

export const cohort = pgTable(
  "cohort",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    programmeId: uuid("programme_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    // FK to framework_release added in the framework migration.
    frameworkReleaseId: uuid("framework_release_id"),
    status: cohortStatus("status").notNull().default("planned"),
    settingsJson: jsonb("settings_json"),
    ...mutableColumns,
  },
  (t) => [
    uniqueIndex("cohort_programme_code_unique").on(t.programmeId, t.code),
    unique("cohort_id_tenant_unique").on(t.id, t.tenantId),
    foreignKey({
      name: "cohort_programme_tenant_fk",
      columns: [t.programmeId, t.tenantId],
      foreignColumns: [programme.id, programme.tenantId],
    }),
  ],
);

export const enrolment = pgTable(
  "enrolment",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    cohortId: uuid("cohort_id").notNull(),
    // Nullable while the enrolment is provisional: it is created alongside the
    // invitation, and binds to the user when the invitation is accepted.
    fellowUserId: uuid("fellow_user_id").references(() => appUser.id),
    // Pinned at creation from the cohort; never drifts (ADR-001, FR-FW-003).
    frameworkReleaseId: uuid("framework_release_id"),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    fte: numeric("fte"),
    status: enrolmentStatus("status").notNull().default("provisional"),
    statusReason: text("status_reason"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    diaryState: diaryState("diary_state").notNull().default("open"),
    // Incremented on every finish. Delayed worker messages carry this value
    // and become harmless when the fellow reopens the diary.
    diaryFinishCycle: integer("diary_finish_cycle").notNull().default(0),
    diaryFinishedAt: timestamp("diary_finished_at", { withTimezone: true }),
    diaryAccessEndsAt: timestamp("diary_access_ends_at", { withTimezone: true }),
    diaryPurgedAt: timestamp("diary_purged_at", { withTimezone: true }),
    ...mutableColumns,
  },
  (t) => [
    unique("enrolment_id_tenant_unique").on(t.id, t.tenantId),
    foreignKey({
      name: "enrolment_cohort_tenant_fk",
      columns: [t.cohortId, t.tenantId],
      foreignColumns: [cohort.id, cohort.tenantId],
    }),
    // One live enrolment per cohort/fellow (spec/05).
    uniqueIndex("enrolment_active_unique")
      .on(t.cohortId, t.fellowUserId)
      .where(sql`${t.status} IN ('provisional', 'active', 'paused')`),
    index("enrolment_fellow_idx").on(t.fellowUserId),
  ],
);

export const supervisorAssignment = pgTable(
  "supervisor_assignment",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    enrolmentId: uuid("enrolment_id").notNull(),
    supervisorUserId: uuid("supervisor_user_id")
      .notNull()
      .references(() => appUser.id),
    assignmentType: assignmentType("assignment_type").notNull(),
    canSign: boolean("can_sign").notNull().default(false),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    appointedBy: uuid("appointed_by"),
    reason: text("reason"),
    ...mutableColumns,
  },
  (t) => [
    foreignKey({
      name: "supervisor_assignment_enrolment_tenant_fk",
      columns: [t.enrolmentId, t.tenantId],
      foreignColumns: [enrolment.id, enrolment.tenantId],
    }),
    // At most one current primary supervisor (spec/05).
    uniqueIndex("supervisor_assignment_current_primary_unique")
      .on(t.enrolmentId)
      .where(sql`${t.assignmentType} = 'primary' AND ${t.endsAt} IS NULL`),
    index("supervisor_assignment_supervisor_idx")
      .on(t.supervisorUserId)
      .where(sql`${t.endsAt} IS NULL`),
  ],
);

// Programme-scoped fellowship duties (spec/05: versioned programme data).
export const duty = pgTable(
  "duty",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    programmeId: uuid("programme_id").notNull(),
    stableCode: text("stable_code").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...mutableColumns,
  },
  (t) => [
    unique("duty_id_tenant_unique").on(t.id, t.tenantId),
    uniqueIndex("duty_programme_code_unique").on(t.programmeId, t.stableCode),
    foreignKey({
      name: "duty_programme_tenant_fk",
      columns: [t.programmeId, t.tenantId],
      foreignColumns: [programme.id, programme.tenantId],
    }),
  ],
);
