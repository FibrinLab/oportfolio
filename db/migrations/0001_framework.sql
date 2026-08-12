CREATE TYPE "public"."cross_mapping_level" AS ENUM('domain', 'objective');--> statement-breakpoint
CREATE TYPE "public"."cross_mapping_provenance" AS ENUM('published', 'faculty_authored', 'imported');--> statement-breakpoint
CREATE TYPE "public"."cross_mapping_relationship" AS ENUM('exact', 'broader', 'narrower', 'related');--> statement-breakpoint
CREATE TYPE "public"."cross_mapping_verification" AS ENUM('verified_against_source', 'unverified', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."release_status" AS ENUM('draft', 'validated', 'published', 'superseded', 'retired');--> statement-breakpoint
CREATE TABLE "cross_mapping" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_release_id" uuid NOT NULL,
	"source_level" "cross_mapping_level" NOT NULL,
	"source_id" uuid NOT NULL,
	"target_node_id" uuid NOT NULL,
	"relationship" "cross_mapping_relationship" NOT NULL,
	"provenance" "cross_mapping_provenance" NOT NULL,
	"verification_status" "cross_mapping_verification" NOT NULL,
	"citation" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "delivery_method" (
	"id" uuid PRIMARY KEY NOT NULL,
	"framework_release_id" uuid NOT NULL,
	"stable_id" text NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain" (
	"id" uuid PRIMARY KEY NOT NULL,
	"framework_release_id" uuid NOT NULL,
	"stable_id" text NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_delivery_method" (
	"domain_id" uuid NOT NULL,
	"delivery_method_id" uuid NOT NULL,
	CONSTRAINT "domain_delivery_method_unique" UNIQUE("domain_id","delivery_method_id")
);
--> statement-breakpoint
CREATE TABLE "external_framework" (
	"id" uuid PRIMARY KEY NOT NULL,
	"framework_release_id" uuid NOT NULL,
	"namespace" text NOT NULL,
	"title" text NOT NULL,
	"publisher" text NOT NULL,
	"version" text NOT NULL,
	"source_url" text,
	"mapping_availability" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "external_node" (
	"id" uuid PRIMARY KEY NOT NULL,
	"external_framework_id" uuid NOT NULL,
	"stable_id" text NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"parent_node_id" uuid
);
--> statement-breakpoint
CREATE TABLE "framework" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid,
	"namespace" text NOT NULL,
	"title" text NOT NULL,
	"publisher" text NOT NULL,
	"canonical_url" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"row_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "framework_release" (
	"id" uuid PRIMARY KEY NOT NULL,
	"framework_id" uuid NOT NULL,
	"version" text NOT NULL,
	"status" "release_status" DEFAULT 'draft' NOT NULL,
	"label" text,
	"published_on" date,
	"effective_from" date,
	"source_url" text NOT NULL,
	"source_document_label" text,
	"source_sha256" text,
	"package_sha256" text NOT NULL,
	"schema_version" text NOT NULL,
	"locale" text DEFAULT 'en-GB' NOT NULL,
	"verification_note" text,
	"release_notes" text,
	"released_by" uuid,
	"released_at" timestamp with time zone,
	"supersedes_release_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"row_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "objective" (
	"id" uuid PRIMARY KEY NOT NULL,
	"framework_release_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	"stable_id" text NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"source_text" text NOT NULL,
	"sort_order" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cross_mapping" ADD CONSTRAINT "cross_mapping_source_release_id_framework_release_id_fk" FOREIGN KEY ("source_release_id") REFERENCES "public"."framework_release"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_mapping" ADD CONSTRAINT "cross_mapping_target_node_id_external_node_id_fk" FOREIGN KEY ("target_node_id") REFERENCES "public"."external_node"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_method" ADD CONSTRAINT "delivery_method_framework_release_id_framework_release_id_fk" FOREIGN KEY ("framework_release_id") REFERENCES "public"."framework_release"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain" ADD CONSTRAINT "domain_framework_release_id_framework_release_id_fk" FOREIGN KEY ("framework_release_id") REFERENCES "public"."framework_release"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_delivery_method" ADD CONSTRAINT "domain_delivery_method_domain_id_domain_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domain"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_delivery_method" ADD CONSTRAINT "domain_delivery_method_delivery_method_id_delivery_method_id_fk" FOREIGN KEY ("delivery_method_id") REFERENCES "public"."delivery_method"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_framework" ADD CONSTRAINT "external_framework_framework_release_id_framework_release_id_fk" FOREIGN KEY ("framework_release_id") REFERENCES "public"."framework_release"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_node" ADD CONSTRAINT "external_node_external_framework_id_external_framework_id_fk" FOREIGN KEY ("external_framework_id") REFERENCES "public"."external_framework"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_node" ADD CONSTRAINT "external_node_parent_fk" FOREIGN KEY ("parent_node_id") REFERENCES "public"."external_node"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framework" ADD CONSTRAINT "framework_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framework_release" ADD CONSTRAINT "framework_release_framework_id_framework_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."framework"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective" ADD CONSTRAINT "objective_framework_release_id_framework_release_id_fk" FOREIGN KEY ("framework_release_id") REFERENCES "public"."framework_release"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective" ADD CONSTRAINT "objective_domain_id_domain_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domain"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cross_mapping_source_idx" ON "cross_mapping" USING btree ("source_release_id","source_level","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_method_release_stable_unique" ON "delivery_method" USING btree ("framework_release_id","stable_id");--> statement-breakpoint
CREATE UNIQUE INDEX "domain_release_stable_unique" ON "domain" USING btree ("framework_release_id","stable_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_framework_release_ns_unique" ON "external_framework" USING btree ("framework_release_id","namespace");--> statement-breakpoint
CREATE UNIQUE INDEX "external_node_framework_stable_unique" ON "external_node" USING btree ("external_framework_id","stable_id");--> statement-breakpoint
CREATE UNIQUE INDEX "framework_namespace_unique" ON "framework" USING btree ("namespace");--> statement-breakpoint
CREATE UNIQUE INDEX "framework_release_version_unique" ON "framework_release" USING btree ("framework_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "objective_release_stable_unique" ON "objective" USING btree ("framework_release_id","stable_id");--> statement-breakpoint
CREATE INDEX "objective_domain_idx" ON "objective" USING btree ("domain_id");;--> statement-breakpoint
-- ============ hand-written additions (do not regenerate away) ============
-- Cross-order FKs from programme tables to framework_release
ALTER TABLE "cohort" ADD CONSTRAINT "cohort_framework_release_fk" FOREIGN KEY ("framework_release_id") REFERENCES "public"."framework_release"("id");--> statement-breakpoint
ALTER TABLE "enrolment" ADD CONSTRAINT "enrolment_framework_release_fk" FOREIGN KEY ("framework_release_id") REFERENCES "public"."framework_release"("id");--> statement-breakpoint

-- ADR-001: published releases are immutable. Reject UPDATE/DELETE on the
-- release row (except the allowed status transitions) and on all rows it owns.
CREATE OR REPLACE FUNCTION reject_published_release_mutation() RETURNS trigger AS $$
DECLARE
  release_id uuid;
  release_status release_status;
BEGIN
  IF TG_TABLE_NAME = 'framework_release' THEN
    release_id := OLD.id;
  ELSIF TG_TABLE_NAME = 'cross_mapping' THEN
    release_id := OLD.source_release_id;
  ELSIF TG_TABLE_NAME = 'external_node' THEN
    SELECT ef.framework_release_id INTO release_id
      FROM external_framework ef WHERE ef.id = OLD.external_framework_id;
  ELSIF TG_TABLE_NAME = 'domain_delivery_method' THEN
    SELECT d.framework_release_id INTO release_id
      FROM domain d WHERE d.id = OLD.domain_id;
  ELSE
    release_id := OLD.framework_release_id;
  END IF;

  SELECT fr.status INTO release_status FROM framework_release fr WHERE fr.id = release_id;

  IF release_status = 'published' THEN
    -- The only permitted change to a published release row is a lifecycle
    -- status transition (published -> superseded/retired).
    IF TG_TABLE_NAME = 'framework_release' AND TG_OP = 'UPDATE'
       AND NEW.status IN ('superseded', 'retired')
       AND NEW.version = OLD.version THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'published framework release content is immutable (ADR-001)';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER framework_release_immutable BEFORE UPDATE OR DELETE ON "framework_release" FOR EACH ROW EXECUTE FUNCTION reject_published_release_mutation();--> statement-breakpoint
CREATE TRIGGER domain_immutable BEFORE UPDATE OR DELETE ON "domain" FOR EACH ROW EXECUTE FUNCTION reject_published_release_mutation();--> statement-breakpoint
CREATE TRIGGER objective_immutable BEFORE UPDATE OR DELETE ON "objective" FOR EACH ROW EXECUTE FUNCTION reject_published_release_mutation();--> statement-breakpoint
CREATE TRIGGER delivery_method_immutable BEFORE UPDATE OR DELETE ON "delivery_method" FOR EACH ROW EXECUTE FUNCTION reject_published_release_mutation();--> statement-breakpoint
CREATE TRIGGER domain_delivery_method_immutable BEFORE UPDATE OR DELETE ON "domain_delivery_method" FOR EACH ROW EXECUTE FUNCTION reject_published_release_mutation();--> statement-breakpoint
CREATE TRIGGER external_framework_immutable BEFORE UPDATE OR DELETE ON "external_framework" FOR EACH ROW EXECUTE FUNCTION reject_published_release_mutation();--> statement-breakpoint
CREATE TRIGGER external_node_immutable BEFORE UPDATE OR DELETE ON "external_node" FOR EACH ROW EXECUTE FUNCTION reject_published_release_mutation();--> statement-breakpoint
CREATE TRIGGER cross_mapping_immutable BEFORE UPDATE OR DELETE ON "cross_mapping" FOR EACH ROW EXECUTE FUNCTION reject_published_release_mutation();--> statement-breakpoint

-- spec/05: a cross-mapping's source_id must belong to the stated level and release.
CREATE OR REPLACE FUNCTION validate_cross_mapping_source() RETURNS trigger AS $$
BEGIN
  IF NEW.source_level = 'domain' THEN
    IF NOT EXISTS (SELECT 1 FROM domain d WHERE d.id = NEW.source_id AND d.framework_release_id = NEW.source_release_id) THEN
      RAISE EXCEPTION 'cross_mapping source_id % is not a domain of release %', NEW.source_id, NEW.source_release_id;
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM objective o WHERE o.id = NEW.source_id AND o.framework_release_id = NEW.source_release_id) THEN
      RAISE EXCEPTION 'cross_mapping source_id % is not an objective of release %', NEW.source_id, NEW.source_release_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER cross_mapping_source_valid BEFORE INSERT OR UPDATE ON "cross_mapping" FOR EACH ROW EXECUTE FUNCTION validate_cross_mapping_source();
