CREATE TYPE "public"."actor_type" AS ENUM('user', 'system', 'worker');--> statement-breakpoint
CREATE TYPE "public"."audit_outcome" AS ENUM('success', 'denied', 'failure');--> statement-breakpoint
CREATE TYPE "public"."magic_link_purpose" AS ENUM('sign_in');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('fellow', 'supervisor', 'faculty', 'tenant_admin');--> statement-breakpoint
CREATE TYPE "public"."membership_scope_type" AS ENUM('tenant', 'programme', 'cohort', 'enrolment');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('active', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."assignment_type" AS ENUM('primary', 'co_supervisor');--> statement-breakpoint
CREATE TYPE "public"."cohort_status" AS ENUM('planned', 'active', 'closed');--> statement-breakpoint
CREATE TYPE "public"."enrolment_status" AS ENUM('provisional', 'active', 'paused', 'completed', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."programme_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid,
	"actor_type" "actor_type" NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid,
	"enrolment_id" uuid,
	"request_id" text,
	"source_context" text,
	"outcome" "audit_outcome" NOT NULL,
	"reason_code" text,
	"metadata_json" jsonb,
	"previous_event_hash" text NOT NULL,
	"event_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_key" (
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_key_tenant_id_key_pk" PRIMARY KEY("tenant_id","key")
);
--> statement-breakpoint
CREATE TABLE "outbox_message" (
	"id" uuid PRIMARY KEY NOT NULL,
	"topic" text NOT NULL,
	"payload_json" jsonb NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_at" timestamp with time zone,
	"last_error" text,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"identity_subject" text,
	"email_normalised" text NOT NULL,
	"display_name" text NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"permissions_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"row_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"permissions_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email_normalised" text NOT NULL,
	"invited_display_name" text NOT NULL,
	"role" "membership_role" NOT NULL,
	"enrolment_id" uuid,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_user_id" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"row_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_rate" (
	"key" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "magic_link_token" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email_normalised" text NOT NULL,
	"user_id" uuid,
	"purpose" "magic_link_purpose" DEFAULT 'sign_in' NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "membership" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "membership_role" NOT NULL,
	"scope_type" "membership_scope_type" DEFAULT 'tenant' NOT NULL,
	"scope_id" uuid,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"granted_by" uuid,
	"grant_reason" text,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"row_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notice_acknowledgement" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"notice_type" text NOT NULL,
	"notice_version" text NOT NULL,
	"acknowledged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"context" text
);
--> statement-breakpoint
CREATE TABLE "policy_set" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"settings_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"row_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "policy_set_id_tenant_unique" UNIQUE("id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"preferred_name" text,
	"professional_group" text,
	"home_specialty_or_role" text,
	"organisation" text,
	"accessibility_preferences_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"row_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" "tenant_status" DEFAULT 'active' NOT NULL,
	"controller_name" text,
	"controller_contact" text,
	"privacy_notice_url" text,
	"default_timezone" text DEFAULT 'Europe/London' NOT NULL,
	"active_policy_set_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"row_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cohort" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"programme_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"framework_release_id" uuid,
	"status" "cohort_status" DEFAULT 'planned' NOT NULL,
	"settings_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"row_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "cohort_id_tenant_unique" UNIQUE("id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "duty" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"programme_id" uuid NOT NULL,
	"stable_code" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"row_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "duty_id_tenant_unique" UNIQUE("id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "enrolment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cohort_id" uuid NOT NULL,
	"fellow_user_id" uuid,
	"framework_release_id" uuid,
	"starts_on" date,
	"ends_on" date,
	"fte" numeric,
	"status" "enrolment_status" DEFAULT 'provisional' NOT NULL,
	"status_reason" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"row_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "enrolment_id_tenant_unique" UNIQUE("id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "programme" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "programme_status" DEFAULT 'active' NOT NULL,
	"default_duration_months" integer,
	"default_fte" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"row_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "programme_id_tenant_unique" UNIQUE("id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "supervisor_assignment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"enrolment_id" uuid NOT NULL,
	"supervisor_user_id" uuid NOT NULL,
	"assignment_type" "assignment_type" NOT NULL,
	"can_sign" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"appointed_by" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"row_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_key" ADD CONSTRAINT "idempotency_key_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_accepted_user_id_app_user_id_fk" FOREIGN KEY ("accepted_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_link_token" ADD CONSTRAINT "magic_link_token_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_acknowledgement" ADD CONSTRAINT "notice_acknowledgement_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_acknowledgement" ADD CONSTRAINT "notice_acknowledgement_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_set" ADD CONSTRAINT "policy_set_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort" ADD CONSTRAINT "cohort_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort" ADD CONSTRAINT "cohort_programme_tenant_fk" FOREIGN KEY ("programme_id","tenant_id") REFERENCES "public"."programme"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duty" ADD CONSTRAINT "duty_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duty" ADD CONSTRAINT "duty_programme_tenant_fk" FOREIGN KEY ("programme_id","tenant_id") REFERENCES "public"."programme"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrolment" ADD CONSTRAINT "enrolment_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrolment" ADD CONSTRAINT "enrolment_fellow_user_id_app_user_id_fk" FOREIGN KEY ("fellow_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrolment" ADD CONSTRAINT "enrolment_cohort_tenant_fk" FOREIGN KEY ("cohort_id","tenant_id") REFERENCES "public"."cohort"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme" ADD CONSTRAINT "programme_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_assignment" ADD CONSTRAINT "supervisor_assignment_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_assignment" ADD CONSTRAINT "supervisor_assignment_supervisor_user_id_app_user_id_fk" FOREIGN KEY ("supervisor_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_assignment" ADD CONSTRAINT "supervisor_assignment_enrolment_tenant_fk" FOREIGN KEY ("enrolment_id","tenant_id") REFERENCES "public"."enrolment"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_event_tenant_time_idx" ON "audit_event" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_event_target_idx" ON "audit_event" USING btree ("tenant_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "outbox_message" USING btree ("run_after") WHERE "outbox_message"."done_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "app_user_email_unique" ON "app_user" USING btree ("email_normalised");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_session_token_hash_unique" ON "auth_session" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_session_user_idx" ON "auth_session" USING btree ("user_id") WHERE "auth_session"."revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_token_hash_unique" ON "invitation" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email_normalised");--> statement-breakpoint
CREATE UNIQUE INDEX "magic_link_token_hash_unique" ON "magic_link_token" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_active_grant_unique" ON "membership" USING btree ("tenant_id","user_id","role","scope_type",coalesce("scope_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "membership"."status" = 'active';--> statement-breakpoint
CREATE INDEX "membership_user_idx" ON "membership" USING btree ("user_id") WHERE "membership"."status" = 'active';--> statement-breakpoint
CREATE INDEX "membership_tenant_idx" ON "membership" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "notice_ack_user_idx" ON "notice_acknowledgement" USING btree ("tenant_id","user_id","notice_type");--> statement-breakpoint
CREATE UNIQUE INDEX "policy_set_tenant_version_unique" ON "policy_set" USING btree ("tenant_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_tenant_user_unique" ON "profile" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_slug_unique" ON "tenant" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "cohort_programme_code_unique" ON "cohort" USING btree ("programme_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "duty_programme_code_unique" ON "duty" USING btree ("programme_id","stable_code");--> statement-breakpoint
CREATE UNIQUE INDEX "enrolment_active_unique" ON "enrolment" USING btree ("cohort_id","fellow_user_id") WHERE "enrolment"."status" IN ('provisional', 'active', 'paused');--> statement-breakpoint
CREATE INDEX "enrolment_fellow_idx" ON "enrolment" USING btree ("fellow_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "programme_tenant_code_unique" ON "programme" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "supervisor_assignment_current_primary_unique" ON "supervisor_assignment" USING btree ("enrolment_id") WHERE "supervisor_assignment"."assignment_type" = 'primary' AND "supervisor_assignment"."ends_at" IS NULL;--> statement-breakpoint
CREATE INDEX "supervisor_assignment_supervisor_idx" ON "supervisor_assignment" USING btree ("supervisor_user_id") WHERE "supervisor_assignment"."ends_at" IS NULL;;--> statement-breakpoint
-- ============ hand-written additions (do not regenerate away) ============
-- Deferred circular / cross-order FKs
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_active_policy_set_fk" FOREIGN KEY ("active_policy_set_id") REFERENCES "public"."policy_set"("id");--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_enrolment_tenant_fk" FOREIGN KEY ("enrolment_id","tenant_id") REFERENCES "public"."enrolment"("id","tenant_id");--> statement-breakpoint
-- audit_event is append-only (spec/05): reject UPDATE/DELETE at the database.
-- A separate low-privilege app role with REVOKE is a deployment concern; the
-- trigger is the invariant.
CREATE OR REPLACE FUNCTION reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% rows are append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER audit_event_append_only
  BEFORE UPDATE OR DELETE ON "audit_event"
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
