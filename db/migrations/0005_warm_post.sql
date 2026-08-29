ALTER TABLE "export_job" DROP CONSTRAINT "export_job_enrolment_id_enrolment_id_fk";
--> statement-breakpoint
ALTER TABLE "retention_hold" DROP CONSTRAINT "retention_hold_enrolment_id_enrolment_id_fk";
--> statement-breakpoint
ALTER TABLE "export_job" ADD CONSTRAINT "export_job_enrolment_tenant_fk" FOREIGN KEY ("enrolment_id","tenant_id") REFERENCES "public"."enrolment"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_hold" ADD CONSTRAINT "retention_hold_enrolment_tenant_fk" FOREIGN KEY ("enrolment_id","tenant_id") REFERENCES "public"."enrolment"("id","tenant_id") ON DELETE no action ON UPDATE no action;