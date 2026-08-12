CREATE TYPE "public"."evidence_workflow_state" AS ENUM('draft', 'shared', 'review_requested');--> statement-breakpoint
CREATE TYPE "public"."link_type" AS ENUM('general', 'repository', 'commit', 'pull_request', 'release', 'notebook', 'other');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('awaiting_upload', 'pending_scan', 'clean', 'rejected', 'quarantined');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('private', 'supervisors', 'faculty');--> statement-breakpoint
CREATE TABLE "attachment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"parent_type" text DEFAULT 'evidence_item' NOT NULL,
	"parent_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"display_name" text NOT NULL,
	"media_type_claimed" text NOT NULL,
	"media_type_detected" text,
	"size_bytes" bigint NOT NULL,
	"sha256" text,
	"scan_status" "scan_status" DEFAULT 'awaiting_upload' NOT NULL,
	"scan_engine_version" text,
	"scan_completed_at" timestamp with time zone,
	"preview_key" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"row_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_duty" (
	"id" uuid PRIMARY KEY NOT NULL,
	"evidence_item_id" uuid NOT NULL,
	"duty_id" uuid NOT NULL,
	"tagged_by" uuid NOT NULL,
	"tagged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_duty_unique" UNIQUE("evidence_item_id","duty_id")
);
--> statement-breakpoint
CREATE TABLE "evidence_goal" (
	"id" uuid PRIMARY KEY NOT NULL,
	"evidence_item_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"linked_by" uuid NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_goal_unique" UNIQUE("evidence_item_id","goal_id")
);
--> statement-breakpoint
CREATE TABLE "evidence_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"enrolment_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"activity_date" date,
	"activity_ended_on" date,
	"evidence_type_id" uuid NOT NULL,
	"narrative_doc" jsonb NOT NULL,
	"narrative_text" text DEFAULT '' NOT NULL,
	"type_fields_json" jsonb,
	"provenance_id" uuid,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"workflow_state" "evidence_workflow_state" DEFAULT 'draft' NOT NULL,
	"review_requested_at" timestamp with time zone,
	"last_reviewed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deletion_due_at" timestamp with time zone,
	"current_revision_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"row_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "evidence_item_id_tenant_unique" UNIQUE("id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "evidence_objective" (
	"id" uuid PRIMARY KEY NOT NULL,
	"evidence_item_id" uuid NOT NULL,
	"objective_id" uuid NOT NULL,
	"mapping_note" text,
	"mapped_by" uuid NOT NULL,
	"mapped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"enrolment_migration_id" uuid
);
--> statement-breakpoint
CREATE TABLE "evidence_revision" (
	"id" uuid PRIMARY KEY NOT NULL,
	"evidence_item_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"snapshot_json" jsonb NOT NULL,
	"changed_fields" jsonb,
	"change_reason" text,
	"content_sha256" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_type" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid,
	"stable_code" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"canonical" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"fields_schema_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"row_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_link" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"evidence_item_id" uuid NOT NULL,
	"link_type" "link_type" DEFAULT 'general' NOT NULL,
	"url" text NOT NULL,
	"host" text NOT NULL,
	"label" text,
	"description" text,
	"captured_metadata_json" jsonb,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"row_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pdp" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"enrolment_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_revision_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"row_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pdp_goal" (
	"id" uuid PRIMARY KEY NOT NULL,
	"pdp_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"target_date" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"row_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provenance_type" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid,
	"stable_code" text NOT NULL,
	"label" text NOT NULL,
	"canonical" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"row_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_duty" ADD CONSTRAINT "evidence_duty_evidence_item_id_evidence_item_id_fk" FOREIGN KEY ("evidence_item_id") REFERENCES "public"."evidence_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_duty" ADD CONSTRAINT "evidence_duty_duty_id_duty_id_fk" FOREIGN KEY ("duty_id") REFERENCES "public"."duty"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_goal" ADD CONSTRAINT "evidence_goal_evidence_item_id_evidence_item_id_fk" FOREIGN KEY ("evidence_item_id") REFERENCES "public"."evidence_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_goal" ADD CONSTRAINT "evidence_goal_goal_id_pdp_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."pdp_goal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_item" ADD CONSTRAINT "evidence_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_item" ADD CONSTRAINT "evidence_item_author_user_id_app_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_item" ADD CONSTRAINT "evidence_item_evidence_type_id_evidence_type_id_fk" FOREIGN KEY ("evidence_type_id") REFERENCES "public"."evidence_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_item" ADD CONSTRAINT "evidence_item_provenance_id_provenance_type_id_fk" FOREIGN KEY ("provenance_id") REFERENCES "public"."provenance_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_item" ADD CONSTRAINT "evidence_item_enrolment_tenant_fk" FOREIGN KEY ("enrolment_id","tenant_id") REFERENCES "public"."enrolment"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_objective" ADD CONSTRAINT "evidence_objective_evidence_item_id_evidence_item_id_fk" FOREIGN KEY ("evidence_item_id") REFERENCES "public"."evidence_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_objective" ADD CONSTRAINT "evidence_objective_objective_id_objective_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."objective"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_revision" ADD CONSTRAINT "evidence_revision_evidence_item_id_evidence_item_id_fk" FOREIGN KEY ("evidence_item_id") REFERENCES "public"."evidence_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_type" ADD CONSTRAINT "evidence_type_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_link" ADD CONSTRAINT "external_link_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_link" ADD CONSTRAINT "external_link_evidence_item_id_evidence_item_id_fk" FOREIGN KEY ("evidence_item_id") REFERENCES "public"."evidence_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdp" ADD CONSTRAINT "pdp_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdp" ADD CONSTRAINT "pdp_enrolment_tenant_fk" FOREIGN KEY ("enrolment_id","tenant_id") REFERENCES "public"."enrolment"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdp_goal" ADD CONSTRAINT "pdp_goal_pdp_id_pdp_id_fk" FOREIGN KEY ("pdp_id") REFERENCES "public"."pdp"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provenance_type" ADD CONSTRAINT "provenance_type_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attachment_object_key_unique" ON "attachment" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "attachment_parent_idx" ON "attachment" USING btree ("parent_type","parent_id") WHERE "attachment"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "evidence_item_enrolment_live_idx" ON "evidence_item" USING btree ("enrolment_id","activity_date") WHERE "evidence_item"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "evidence_item_author_idx" ON "evidence_item" USING btree ("author_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_objective_active_unique" ON "evidence_objective" USING btree ("evidence_item_id","objective_id") WHERE "evidence_objective"."valid_to" IS NULL;--> statement-breakpoint
CREATE INDEX "evidence_objective_objective_idx" ON "evidence_objective" USING btree ("objective_id") WHERE "evidence_objective"."valid_to" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_revision_item_number_unique" ON "evidence_revision" USING btree ("evidence_item_id","revision_number");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_type_code_unique" ON "evidence_type" USING btree (coalesce("tenant_id", '00000000-0000-0000-0000-000000000000'::uuid),"stable_code");--> statement-breakpoint
CREATE INDEX "external_link_item_idx" ON "external_link" USING btree ("evidence_item_id") WHERE "external_link"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "pdp_enrolment_unique" ON "pdp" USING btree ("enrolment_id");--> statement-breakpoint
CREATE INDEX "pdp_goal_pdp_idx" ON "pdp_goal" USING btree ("pdp_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provenance_type_code_unique" ON "provenance_type" USING btree (coalesce("tenant_id", '00000000-0000-0000-0000-000000000000'::uuid),"stable_code");;--> statement-breakpoint
-- ============ hand-written additions (do not regenerate away) ============
-- evidence_revision is append-only (spec/05).
CREATE TRIGGER evidence_revision_append_only
  BEFORE UPDATE OR DELETE ON "evidence_revision"
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();--> statement-breakpoint
-- Invariant 2: an evidence objective mapping must reference an objective in
-- the enrolment's pinned (or historically migrated) framework release.
CREATE OR REPLACE FUNCTION validate_evidence_objective_release() RETURNS trigger AS $$
DECLARE
  enrolment_release uuid;
  objective_release uuid;
BEGIN
  SELECT e.framework_release_id INTO enrolment_release
    FROM enrolment e JOIN evidence_item ei ON ei.enrolment_id = e.id
    WHERE ei.id = NEW.evidence_item_id;
  SELECT o.framework_release_id INTO objective_release
    FROM objective o WHERE o.id = NEW.objective_id;
  IF enrolment_release IS NULL OR objective_release IS DISTINCT FROM enrolment_release THEN
    IF NEW.enrolment_migration_id IS NULL THEN
      RAISE EXCEPTION 'objective % is not in the enrolment''s pinned framework release', NEW.objective_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER evidence_objective_release_valid
  BEFORE INSERT OR UPDATE ON "evidence_objective"
  FOR EACH ROW EXECUTE FUNCTION validate_evidence_objective_release();
