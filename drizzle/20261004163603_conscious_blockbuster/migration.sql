CREATE TYPE "offer_letter_status" AS ENUM('draft', 'issued', 'accepted', 'declined', 'revoked');--> statement-breakpoint
CREATE TABLE "offer_letters" (
	"id" text PRIMARY KEY,
	"offer_no" text NOT NULL,
	"user_id" text NOT NULL,
	"internship_id" text,
	"company_name" text NOT NULL,
	"designation" text NOT NULL,
	"location" text,
	"compensation" text,
	"joining_date" timestamp,
	"duration" text,
	"body" text,
	"pdf_url" text,
	"issued_at" timestamp,
	"expires_at" timestamp,
	"status" "offer_letter_status" DEFAULT 'draft'::"offer_letter_status" NOT NULL,
	"responded_at" timestamp,
	"decline_reason" text,
	"revoke_reason" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "offer_letters_offer_no_unique" ON "offer_letters" ("offer_no");--> statement-breakpoint
CREATE INDEX "offer_letters_user_id_idx" ON "offer_letters" ("user_id");--> statement-breakpoint
CREATE INDEX "offer_letters_internship_id_idx" ON "offer_letters" ("internship_id");--> statement-breakpoint
CREATE INDEX "offer_letters_status_idx" ON "offer_letters" ("status");--> statement-breakpoint
CREATE INDEX "offer_letters_created_at_idx" ON "offer_letters" ("created_at");--> statement-breakpoint
ALTER TABLE "offer_letters" ADD CONSTRAINT "offer_letters_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "offer_letters" ADD CONSTRAINT "offer_letters_internship_id_internships_id_fkey" FOREIGN KEY ("internship_id") REFERENCES "internships"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "offer_letters" ADD CONSTRAINT "offer_letters_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL;