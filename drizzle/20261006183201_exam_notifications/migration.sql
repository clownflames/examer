CREATE TYPE "exam_notification_status" AS ENUM('queued', 'sent', 'delivered', 'failed', 'bounced', 'complained');--> statement-breakpoint
CREATE TABLE "exam_notifications" (
	"id" text PRIMARY KEY,
	"exam_id" text NOT NULL,
	"user_id" text NOT NULL,
	"recipient_email" text NOT NULL,
	"status" "exam_notification_status" DEFAULT 'queued'::"exam_notification_status" NOT NULL,
	"provider_id" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"failed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "exam_notifications_exam_user_unique" ON "exam_notifications" ("exam_id","user_id");--> statement-breakpoint
CREATE INDEX "exam_notifications_exam_id_idx" ON "exam_notifications" ("exam_id");--> statement-breakpoint
CREATE INDEX "exam_notifications_status_idx" ON "exam_notifications" ("status");--> statement-breakpoint
CREATE INDEX "exam_notifications_user_id_idx" ON "exam_notifications" ("user_id");--> statement-breakpoint
ALTER TABLE "exam_notifications" ADD CONSTRAINT "exam_notifications_exam_id_exams_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "exam_notifications" ADD CONSTRAINT "exam_notifications_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;