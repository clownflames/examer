CREATE TYPE "payment_status" AS ENUM('pending', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY,
	"title" text NOT NULL,
	"description" text,
	"content" jsonb NOT NULL,
	"pdf_url" text,
	"pdf_key" text,
	"created_by" text,
	"is_template" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_demand" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"icon_url" text,
	"description" text,
	"key_features" jsonb
);
--> statement-breakpoint
CREATE TABLE "exam_questions" (
	"id" text PRIMARY KEY,
	"exam_id" text NOT NULL,
	"name" text NOT NULL,
	"marks" integer DEFAULT 1 NOT NULL,
	"details" text,
	"type" text NOT NULL,
	"default_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_submission" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"exam_id" text NOT NULL,
	"answers" jsonb,
	"signature" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"submitted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" text PRIMARY KEY,
	"internship_id" text NOT NULL,
	"order_no" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration" integer NOT NULL,
	"total_marks" integer DEFAULT 100 NOT NULL,
	"passing_marks" integer,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internship_registration" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"internship_id" text NOT NULL,
	"cover_letter" text,
	"resume_url" text,
	"gain_score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internships" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"demand_id" text NOT NULL,
	"description" text,
	"last_submission_date" timestamp,
	"start_date" timestamp,
	"end_date" timestamp,
	"jd_url" text,
	"price" numeric(10,2),
	"selling_price" numeric(10,2),
	"examiner_name" text,
	"examiner_photo_url" text,
	"total_score" integer DEFAULT 100 NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" text PRIMARY KEY,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"url" text NOT NULL,
	"key" text NOT NULL,
	"width" integer,
	"height" integer,
	"tags" jsonb DEFAULT '[]',
	"uploaded_by" text,
	"uploaded_by_role" "user_role" DEFAULT 'user'::"user_role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"text" text,
	"code" text,
	"code_language" text,
	"is_edited" boolean DEFAULT false NOT NULL,
	"by_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"registration_id" text NOT NULL,
	"internship_id" text NOT NULL,
	"amount" numeric(10,2) NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" "payment_status" DEFAULT 'pending'::"payment_status" NOT NULL,
	"razorpay_order_id" text,
	"razorpay_payment_id" text,
	"razorpay_signature" text,
	"failure_reason" text,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL UNIQUE,
	"headline" text,
	"bio" text,
	"phone" text,
	"college_name" text,
	"university_name" text,
	"degree" text,
	"branch" text,
	"roll_number" text,
	"graduation_year" integer,
	"cgpa" numeric(4,2),
	"city" text,
	"state" text,
	"country" text DEFAULT 'India',
	"pincode" text,
	"github_url" text,
	"linkedin_url" text,
	"portfolio_url" text,
	"twitter_url" text,
	"skills" jsonb DEFAULT '[]',
	"languages" jsonb DEFAULT '[]',
	"experience" jsonb DEFAULT '[]',
	"projects" jsonb DEFAULT '[]',
	"achievements" jsonb DEFAULT '[]',
	"resume_url" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"profile_completion" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_mcqs" (
	"id" text PRIMARY KEY,
	"question_id" text NOT NULL,
	"label_text" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_submission" (
	"id" text PRIMARY KEY,
	"question_id" text NOT NULL,
	"exam_submission_id" text NOT NULL,
	"option_id" text,
	"text" text,
	"is_correct" boolean
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio_documents" (
	"id" text PRIMARY KEY,
	"title" text NOT NULL,
	"description" text,
	"craft_json" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"demand_id" text NOT NULL,
	"internship_id" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_final_result" (
	"id" text PRIMARY KEY,
	"team_id" text NOT NULL,
	"score" integer NOT NULL,
	"result" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_goals" (
	"id" text PRIMARY KEY,
	"team_id" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_member" (
	"id" text PRIMARY KEY,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"internship_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'user'::"user_role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" ("user_id");--> statement-breakpoint
CREATE INDEX "documents_created_by_idx" ON "documents" ("created_by");--> statement-breakpoint
CREATE INDEX "documents_created_at_idx" ON "documents" ("created_at");--> statement-breakpoint
CREATE INDEX "exam_questions_exam_id_idx" ON "exam_questions" ("exam_id");--> statement-breakpoint
CREATE INDEX "exam_submission_user_id_idx" ON "exam_submission" ("user_id");--> statement-breakpoint
CREATE INDEX "exam_submission_exam_id_idx" ON "exam_submission" ("exam_id");--> statement-breakpoint
CREATE INDEX "exams_internship_id_idx" ON "exams" ("internship_id");--> statement-breakpoint
CREATE INDEX "internship_registration_user_id_idx" ON "internship_registration" ("user_id");--> statement-breakpoint
CREATE INDEX "internship_registration_internship_id_idx" ON "internship_registration" ("internship_id");--> statement-breakpoint
CREATE INDEX "internships_demand_id_idx" ON "internships" ("demand_id");--> statement-breakpoint
CREATE INDEX "media_assets_uploaded_by_idx" ON "media_assets" ("uploaded_by");--> statement-breakpoint
CREATE INDEX "media_assets_uploaded_by_role_idx" ON "media_assets" ("uploaded_by_role");--> statement-breakpoint
CREATE INDEX "media_assets_created_at_idx" ON "media_assets" ("created_at");--> statement-breakpoint
CREATE INDEX "media_assets_mime_type_idx" ON "media_assets" ("mime_type");--> statement-breakpoint
CREATE INDEX "messages_team_id_idx" ON "messages" ("team_id");--> statement-breakpoint
CREATE INDEX "messages_user_id_idx" ON "messages" ("user_id");--> statement-breakpoint
CREATE INDEX "payments_user_id_idx" ON "payments" ("user_id");--> statement-breakpoint
CREATE INDEX "payments_registration_id_idx" ON "payments" ("registration_id");--> statement-breakpoint
CREATE INDEX "payments_internship_id_idx" ON "payments" ("internship_id");--> statement-breakpoint
CREATE INDEX "payments_razorpay_order_id_idx" ON "payments" ("razorpay_order_id");--> statement-breakpoint
CREATE INDEX "profile_user_id_idx" ON "profile" ("user_id");--> statement-breakpoint
CREATE INDEX "question_mcqs_question_id_idx" ON "question_mcqs" ("question_id");--> statement-breakpoint
CREATE INDEX "question_submission_question_id_idx" ON "question_submission" ("question_id");--> statement-breakpoint
CREATE INDEX "question_submission_exam_submission_id_idx" ON "question_submission" ("exam_submission_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" ("user_id");--> statement-breakpoint
CREATE INDEX "studio_documents_created_by_idx" ON "studio_documents" ("created_by");--> statement-breakpoint
CREATE INDEX "studio_documents_created_at_idx" ON "studio_documents" ("created_at");--> statement-breakpoint
CREATE INDEX "team_demand_id_idx" ON "team" ("demand_id");--> statement-breakpoint
CREATE INDEX "team_internship_id_idx" ON "team" ("internship_id");--> statement-breakpoint
CREATE INDEX "team_final_result_team_id_idx" ON "team_final_result" ("team_id");--> statement-breakpoint
CREATE INDEX "team_goals_team_id_idx" ON "team_goals" ("team_id");--> statement-breakpoint
CREATE INDEX "team_member_team_id_idx" ON "team_member" ("team_id");--> statement-breakpoint
CREATE INDEX "team_member_user_id_idx" ON "team_member" ("user_id");--> statement-breakpoint
CREATE INDEX "team_member_internship_id_idx" ON "team_member" ("internship_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_member_user_internship_unique" ON "team_member" ("user_id","internship_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_exam_id_exams_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "exam_submission" ADD CONSTRAINT "exam_submission_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "exam_submission" ADD CONSTRAINT "exam_submission_exam_id_exams_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_internship_id_internships_id_fkey" FOREIGN KEY ("internship_id") REFERENCES "internships"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "internship_registration" ADD CONSTRAINT "internship_registration_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "internship_registration" ADD CONSTRAINT "internship_registration_internship_id_internships_id_fkey" FOREIGN KEY ("internship_id") REFERENCES "internships"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "internships" ADD CONSTRAINT "internships_demand_id_employee_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "employee_demand"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_team_id_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_registration_id_internship_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "internship_registration"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_internship_id_internships_id_fkey" FOREIGN KEY ("internship_id") REFERENCES "internships"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "question_mcqs" ADD CONSTRAINT "question_mcqs_question_id_exam_questions_id_fkey" FOREIGN KEY ("question_id") REFERENCES "exam_questions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "question_submission" ADD CONSTRAINT "question_submission_question_id_exam_questions_id_fkey" FOREIGN KEY ("question_id") REFERENCES "exam_questions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "question_submission" ADD CONSTRAINT "question_submission_exam_submission_id_exam_submission_id_fkey" FOREIGN KEY ("exam_submission_id") REFERENCES "exam_submission"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "question_submission" ADD CONSTRAINT "question_submission_option_id_question_mcqs_id_fkey" FOREIGN KEY ("option_id") REFERENCES "question_mcqs"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "studio_documents" ADD CONSTRAINT "studio_documents_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_demand_id_employee_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "employee_demand"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_internship_id_internships_id_fkey" FOREIGN KEY ("internship_id") REFERENCES "internships"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "team_final_result" ADD CONSTRAINT "team_final_result_team_id_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "team_goals" ADD CONSTRAINT "team_goals_team_id_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_internship_id_internships_id_fkey" FOREIGN KEY ("internship_id") REFERENCES "internships"("id") ON DELETE CASCADE;