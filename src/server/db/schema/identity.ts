import { sql } from "drizzle-orm";
import {
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

export const tenantStatus = pgEnum("tenant_status", ["active", "suspended", "archived"]);
export const userStatus = pgEnum("user_status", ["active", "suspended"]);
export const membershipRole = pgEnum("membership_role", [
  "fellow",
  "supervisor",
  "faculty",
  "tenant_admin",
]);
export const membershipStatus = pgEnum("membership_status", ["active", "revoked"]);
export const membershipScopeType = pgEnum("membership_scope_type", [
  "tenant",
  "programme",
  "cohort",
  "enrolment",
]);
export const magicLinkPurpose = pgEnum("magic_link_purpose", ["sign_in"]);

export const tenant = pgTable(
  "tenant",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: tenantStatus("status").notNull().default("active"),
    controllerName: text("controller_name"),
    controllerContact: text("controller_contact"),
    privacyNoticeUrl: text("privacy_notice_url"),
    defaultTimezone: text("default_timezone").notNull().default("Europe/London"),
    activePolicySetId: uuid("active_policy_set_id"),
    ...mutableColumns,
  },
  (t) => [
    uniqueIndex("tenant_slug_unique").on(t.slug),
    // Parent side of composite tenant FKs (invariant 1) is (id) itself here.
  ],
);

export const policySet = pgTable(
  "policy_set",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    version: integer("version").notNull().default(1),
    // Visibility options, upload allowlist/limits, notification defaults,
    // reporting threshold, retention mapping, break-glass flag (spec/05).
    settingsJson: jsonb("settings_json").notNull(),
    ...mutableColumns,
  },
  (t) => [
    unique("policy_set_id_tenant_unique").on(t.id, t.tenantId),
    uniqueIndex("policy_set_tenant_version_unique").on(t.tenantId, t.version),
  ],
);

// Global identity only; professional details live in the tenant-scoped profile.
export const appUser = pgTable(
  "app_user",
  {
    id: uuid("id").primaryKey(),
    identitySubject: text("identity_subject"),
    emailNormalised: text("email_normalised").notNull(),
    displayName: text("display_name").notNull(),
    status: userStatus("status").notNull().default("active"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    // Bumped on any membership/role change; sessions carrying an older value
    // are rotated and permissions reloaded on next request (NFR-S-005).
    permissionsVersion: integer("permissions_version").notNull().default(1),
    ...mutableColumns,
  },
  (t) => [uniqueIndex("app_user_email_unique").on(t.emailNormalised)],
);

export const membership = pgTable(
  "membership",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id),
    role: membershipRole("role").notNull(),
    scopeType: membershipScopeType("scope_type").notNull().default("tenant"),
    scopeId: uuid("scope_id"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    grantedBy: uuid("granted_by"),
    grantReason: text("grant_reason"),
    status: membershipStatus("status").notNull().default("active"),
    ...mutableColumns,
  },
  (t) => [
    // Unique active grant across tenant/user/role/scope (spec/05).
    uniqueIndex("membership_active_grant_unique")
      .on(t.tenantId, t.userId, t.role, t.scopeType, sql`coalesce(${t.scopeId}, '00000000-0000-0000-0000-000000000000'::uuid)`)
      .where(sql`${t.status} = 'active'`),
    index("membership_user_idx").on(t.userId).where(sql`${t.status} = 'active'`),
    index("membership_tenant_idx").on(t.tenantId),
  ],
);

export const profile = pgTable(
  "profile",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id),
    preferredName: text("preferred_name"),
    professionalGroup: text("professional_group"),
    homeSpecialtyOrRole: text("home_specialty_or_role"),
    organisation: text("organisation"),
    accessibilityPreferencesJson: jsonb("accessibility_preferences_json"),
    ...mutableColumns,
  },
  (t) => [uniqueIndex("profile_tenant_user_unique").on(t.tenantId, t.userId)],
);

export const invitation = pgTable(
  "invitation",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    emailNormalised: text("email_normalised").notNull(),
    invitedDisplayName: text("invited_display_name").notNull(),
    role: membershipRole("role").notNull(),
    // Provisional enrolment created alongside a fellow invitation.
    // FK added in the programme migration (table order).
    enrolmentId: uuid("enrolment_id"),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedUserId: uuid("accepted_user_id").references(() => appUser.id),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...mutableColumns,
  },
  (t) => [
    uniqueIndex("invitation_token_hash_unique").on(t.tokenHash),
    index("invitation_email_idx").on(t.emailNormalised),
  ],
);

export const authSession = pgTable(
  "auth_session",
  {
    id: uuid("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id),
    permissionsVersion: integer("permissions_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    absoluteExpiresAt: timestamp("absolute_expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("auth_session_token_hash_unique").on(t.tokenHash),
    index("auth_session_user_idx").on(t.userId).where(sql`${t.revokedAt} IS NULL`),
  ],
);

export const magicLinkToken = pgTable(
  "magic_link_token",
  {
    id: uuid("id").primaryKey(),
    emailNormalised: text("email_normalised").notNull(),
    userId: uuid("user_id").references(() => appUser.id),
    purpose: magicLinkPurpose("purpose").notNull().default("sign_in"),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("magic_link_token_hash_unique").on(t.tokenHash)],
);

// Fixed-window rate limiting for auth endpoints (spec/12: rate-limit
// authentication/invitations; avoid account-enumerating responses).
export const loginRate = pgTable("login_rate", {
  key: text("key").primaryKey(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
});

// Records receipt/acknowledgement of notices (privacy, no-patient-data,
// reflection safety) — not consent unless consent is the chosen basis (spec/05).
export const noticeAcknowledgement = pgTable(
  "notice_acknowledgement",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id),
    noticeType: text("notice_type").notNull(),
    noticeVersion: text("notice_version").notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }).notNull().defaultNow(),
    context: text("context"),
  },
  (t) => [index("notice_ack_user_idx").on(t.tenantId, t.userId, t.noticeType)],
);

// End-to-end encryption key material (ADR-007). The diary key itself never
// reaches the server: this row holds it wrapped under a passphrase-derived
// KEK and under a recovery-key-derived KEK, plus KDF parameters. Losing the
// passphrase and recovery key makes the diary unrecoverable by design.
export const diaryKey = pgTable("diary_key", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => appUser.id),
  keyVersion: integer("key_version").notNull().default(1),
  materialJson: jsonb("material_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
