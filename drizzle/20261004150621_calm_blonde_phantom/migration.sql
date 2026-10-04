CREATE TYPE "certificate_status" AS ENUM('issued', 'revoked');--> statement-breakpoint
CREATE TYPE "verification_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" text PRIMARY KEY,
	"certificate_no" text NOT NULL UNIQUE,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"image_url" text,
	"internship_id" text,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"status" "certificate_status" DEFAULT 'issued'::"certificate_status" NOT NULL,
	"revoke_reason" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_requests" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"certificate_id" text,
	"verifier_name" text NOT NULL,
	"verifier_email" text NOT NULL,
	"organisation" text,
	"note" text,
	"status" "verification_status" DEFAULT 'pending'::"verification_status" NOT NULL,
	"reviewed_by" text,
	"review_note" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "certificates_user_id_idx" ON "certificates" ("user_id");--> statement-breakpoint
CREATE INDEX "certificates_certificate_no_idx" ON "certificates" ("certificate_no");--> statement-breakpoint
CREATE INDEX "certificates_status_idx" ON "certificates" ("status");--> statement-breakpoint
CREATE INDEX "certificates_created_at_idx" ON "certificates" ("created_at");--> statement-breakpoint
CREATE INDEX "verification_requests_user_id_idx" ON "verification_requests" ("user_id");--> statement-breakpoint
CREATE INDEX "verification_requests_status_idx" ON "verification_requests" ("status");--> statement-breakpoint
CREATE INDEX "verification_requests_created_at_idx" ON "verification_requests" ("created_at");--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_internship_id_internships_id_fkey" FOREIGN KEY ("internship_id") REFERENCES "internships"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_certificate_id_certificates_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "user"("id") ON DELETE SET NULL;