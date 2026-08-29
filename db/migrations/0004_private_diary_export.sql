CREATE TYPE "public"."export_kind" AS ENUM('standard', 'final');--> statement-breakpoint
CREATE TYPE "public"."export_status" AS ENUM('queued', 'processing', 'ready', 'failed', 'superseded', 'expired');--> statement-breakpoint
CREATE TYPE "public"."diary_state" AS ENUM('open', 'finished', 'purged');--> statement-breakpoint
CREATE TABLE "export_job" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"enrolment_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"kind" "export_kind" DEFAULT 'standard' NOT NULL,
	"status" "export_status" DEFAULT 'queued' NOT NULL,
	"finish_cycle" integer,
	"snapshot_json" jsonb NOT NULL,
	"object_key" text,
	"archive_sha256" text,
	"size_bytes" bigint,
	"failure_code" text,
	"failure_detail" text,
	"artifact_expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"downloaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retention_hold" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"enrolment_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"placed_by" uuid NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_by" uuid,
	"released_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "evidence_item" ALTER COLUMN "evidence_type_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "enrolment" ADD COLUMN "diary_state" "diary_state" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "enrolment" ADD COLUMN "diary_finish_cycle" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "enrolment" ADD COLUMN "diary_finished_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enrolment" ADD COLUMN "diary_access_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enrolment" ADD COLUMN "diary_purged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "export_job" ADD CONSTRAINT "export_job_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_job" ADD CONSTRAINT "export_job_enrolment_id_enrolment_id_fk" FOREIGN KEY ("enrolment_id") REFERENCES "public"."enrolment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_job" ADD CONSTRAINT "export_job_requested_by_app_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_hold" ADD CONSTRAINT "retention_hold_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_hold" ADD CONSTRAINT "retention_hold_enrolment_id_enrolment_id_fk" FOREIGN KEY ("enrolment_id") REFERENCES "public"."enrolment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_hold" ADD CONSTRAINT "retention_hold_placed_by_app_user_id_fk" FOREIGN KEY ("placed_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_hold" ADD CONSTRAINT "retention_hold_released_by_app_user_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "export_job_owner_idx" ON "export_job" USING btree ("enrolment_id","requested_by","created_at");--> statement-breakpoint
CREATE INDEX "export_job_pending_idx" ON "export_job" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "retention_hold_active_unique" ON "retention_hold" USING btree ("enrolment_id") WHERE "retention_hold"."released_at" IS NULL;--> statement-breakpoint
CREATE INDEX "retention_hold_enrolment_idx" ON "retention_hold" USING btree ("enrolment_id");--> statement-breakpoint

-- The diary is private-only. Preserve legacy rows while permanently
-- narrowing every former audience and workflow state.
UPDATE "evidence_item"
SET "visibility" = 'private',
    "workflow_state" = 'draft',
    "review_requested_at" = NULL,
    "last_reviewed_at" = NULL;--> statement-breakpoint
ALTER TABLE "evidence_item"
  ADD CONSTRAINT "evidence_item_private_only_check"
  CHECK ("visibility" = 'private' AND "workflow_state" = 'draft');--> statement-breakpoint

-- Ordinary revision updates/deletes remain forbidden. The retention purge
-- function sets a transaction-local marker only after checking lifecycle and
-- legal-hold conditions.
CREATE OR REPLACE FUNCTION reject_evidence_revision_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.diary_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% rows are append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER evidence_revision_append_only ON "evidence_revision";--> statement-breakpoint
CREATE TRIGGER evidence_revision_append_only
  BEFORE UPDATE OR DELETE ON "evidence_revision"
  FOR EACH ROW EXECUTE FUNCTION reject_evidence_revision_mutation();--> statement-breakpoint

CREATE OR REPLACE FUNCTION purge_diary_contents(
  p_enrolment_id uuid,
  p_finish_cycle integer
) RETURNS boolean AS $$
DECLARE
  eligible boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM enrolment e
    WHERE e.id = p_enrolment_id
      AND e.diary_state = 'finished'
      AND e.diary_finish_cycle = p_finish_cycle
      AND e.diary_access_ends_at <= now()
      AND NOT EXISTS (
        SELECT 1 FROM retention_hold h
        WHERE h.enrolment_id = e.id AND h.released_at IS NULL
      )
  ) INTO eligible;
  IF NOT eligible THEN
    RETURN false;
  END IF;

  PERFORM set_config('app.diary_purge', 'on', true);

  DELETE FROM evidence_goal eg USING evidence_item ei
    WHERE eg.evidence_item_id = ei.id AND ei.enrolment_id = p_enrolment_id;
  DELETE FROM evidence_duty ed USING evidence_item ei
    WHERE ed.evidence_item_id = ei.id AND ei.enrolment_id = p_enrolment_id;
  DELETE FROM evidence_objective eo USING evidence_item ei
    WHERE eo.evidence_item_id = ei.id AND ei.enrolment_id = p_enrolment_id;
  DELETE FROM external_link el USING evidence_item ei
    WHERE el.evidence_item_id = ei.id AND ei.enrolment_id = p_enrolment_id;
  DELETE FROM attachment a USING evidence_item ei
    WHERE a.parent_type = 'evidence_item'
      AND a.parent_id = ei.id
      AND ei.enrolment_id = p_enrolment_id;
  DELETE FROM evidence_revision er USING evidence_item ei
    WHERE er.evidence_item_id = ei.id AND ei.enrolment_id = p_enrolment_id;
  DELETE FROM evidence_item WHERE enrolment_id = p_enrolment_id;

  UPDATE export_job
    SET snapshot_json = '{"purged":true}'::jsonb,
        object_key = NULL,
        archive_sha256 = NULL,
        size_bytes = NULL,
        status = CASE WHEN status = 'superseded' THEN status ELSE 'expired' END,
        updated_at = now()
    WHERE enrolment_id = p_enrolment_id;
  UPDATE enrolment
    SET diary_state = 'purged',
        diary_purged_at = now(),
        updated_at = now(),
        row_version = row_version + 1
    WHERE id = p_enrolment_id;
  RETURN true;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
