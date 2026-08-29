ALTER TYPE "public"."scan_status" ADD VALUE 'sealed';--> statement-breakpoint
CREATE TABLE "diary_key" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"material_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachment" ADD COLUMN "encrypted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attachment" ADD COLUMN "name_enc" jsonb;--> statement-breakpoint
ALTER TABLE "evidence_item" ADD COLUMN "encrypted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_item" ADD COLUMN "content_enc" jsonb;--> statement-breakpoint
ALTER TABLE "external_link" ADD COLUMN "encrypted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "external_link" ADD COLUMN "link_enc" jsonb;--> statement-breakpoint
ALTER TABLE "diary_key" ADD CONSTRAINT "diary_key_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_encrypted_no_plaintext_check" CHECK (NOT "attachment"."encrypted" OR ("attachment"."display_name" = 'sealed' AND "attachment"."original_filename" = 'sealed' AND "attachment"."name_enc" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "evidence_item" ADD CONSTRAINT "evidence_item_encrypted_no_plaintext_check" CHECK (NOT "evidence_item"."encrypted" OR ("evidence_item"."title" = '' AND "evidence_item"."narrative_text" = '' AND "evidence_item"."content_enc" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "external_link" ADD CONSTRAINT "external_link_encrypted_no_plaintext_check" CHECK (NOT "external_link"."encrypted" OR ("external_link"."url" = '' AND "external_link"."host" = '' AND "external_link"."label" IS NULL AND "external_link"."description" IS NULL AND "external_link"."link_enc" IS NOT NULL));