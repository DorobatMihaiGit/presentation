CREATE TYPE "public"."email_status" AS ENUM('sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'contract', 'freelance');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('en', 'ro');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'document');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('new', 'read', 'archived', 'spam');--> statement-breakpoint
CREATE TYPE "public"."stack_layer" AS ENUM('interface', 'api', 'data', 'infra', 'craft');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
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
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experience" (
	"id" text PRIMARY KEY NOT NULL,
	"company" text NOT NULL,
	"url" text,
	"logo_media_id" uuid,
	"start_date" text NOT NULL,
	"end_date" text,
	"employment_type" "employment_type" NOT NULL,
	"sort_order" integer NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "experience_start_date" CHECK ("experience"."start_date" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "experience_end_date" CHECK ("experience"."end_date" is null or ("experience"."end_date" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' and "experience"."end_date" >= "experience"."start_date"))
);
--> statement-breakpoint
CREATE TABLE "experience_i18n" (
	"experience_id" text NOT NULL,
	"locale" "locale" NOT NULL,
	"role_title" text DEFAULT '' NOT NULL,
	"description_md" text DEFAULT '' NOT NULL,
	"highlights" text[] DEFAULT '{}' NOT NULL,
	CONSTRAINT "experience_i18n_experience_id_locale_pk" PRIMARY KEY("experience_id","locale")
);
--> statement-breakpoint
CREATE TABLE "experience_skill" (
	"experience_id" text NOT NULL,
	"skill_slug" text NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "experience_skill_experience_id_skill_slug_pk" PRIMARY KEY("experience_id","skill_slug")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blob_url" text NOT NULL,
	"pathname" text NOT NULL,
	"kind" "media_kind" NOT NULL,
	"mime" text NOT NULL,
	"width" integer,
	"height" integer,
	"bytes" integer NOT NULL,
	"lqip" text,
	"alt_en" text DEFAULT '' NOT NULL,
	"alt_ro" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_pathname_unique" UNIQUE("pathname")
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"company" text,
	"body" text NOT NULL,
	"locale" "locale" NOT NULL,
	"ip_hash" text NOT NULL,
	"status" "message_status" DEFAULT 'new' NOT NULL,
	"email_status" "email_status",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"email_public" text NOT NULL,
	"location" text NOT NULL,
	"country_code" text NOT NULL,
	"avatar_media_id" uuid,
	"socials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"years_exp" smallint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_singleton" CHECK ("profile"."id" = 1),
	CONSTRAINT "profile_country_code" CHECK ("profile"."country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "profile_years_exp" CHECK ("profile"."years_exp" between 0 and 80)
);
--> statement-breakpoint
CREATE TABLE "profile_i18n" (
	"profile_id" smallint NOT NULL,
	"locale" "locale" NOT NULL,
	"full_name" text DEFAULT '' NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"summary_md" text DEFAULT '' NOT NULL,
	"seo_title" text DEFAULT '' NOT NULL,
	"seo_description" text DEFAULT '' NOT NULL,
	"cv_pdf_media_id" uuid,
	CONSTRAINT "profile_i18n_profile_id_locale_pk" PRIMARY KEY("profile_id","locale")
);
--> statement-breakpoint
CREATE TABLE "project" (
	"slug" text PRIMARY KEY NOT NULL,
	"repo_url" text,
	"live_url" text,
	"cover_media_id" uuid,
	"video_media_id" uuid,
	"year" smallint NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_year" CHECK ("project"."year" between 1990 and 2100)
);
--> statement-breakpoint
CREATE TABLE "project_i18n" (
	"project_slug" text NOT NULL,
	"locale" "locale" NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"body_md" text DEFAULT '' NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"outcome" text DEFAULT '' NOT NULL,
	CONSTRAINT "project_i18n_project_slug_locale_pk" PRIMARY KEY("project_slug","locale")
);
--> statement-breakpoint
CREATE TABLE "project_skill" (
	"project_slug" text NOT NULL,
	"skill_slug" text NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "project_skill_project_slug_skill_slug_pk" PRIMARY KEY("project_slug","skill_slug")
);
--> statement-breakpoint
CREATE TABLE "skill" (
	"slug" text PRIMARY KEY NOT NULL,
	"category_slug" text NOT NULL,
	"name" text NOT NULL,
	"level" smallint NOT NULL,
	"years" smallint NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "skill_level" CHECK ("skill"."level" between 1 and 5),
	CONSTRAINT "skill_years" CHECK ("skill"."years" between 0 and 80)
);
--> statement-breakpoint
CREATE TABLE "skill_category" (
	"slug" text PRIMARY KEY NOT NULL,
	"layer" "stack_layer" NOT NULL,
	CONSTRAINT "skill_category_layer_unique" UNIQUE("layer")
);
--> statement-breakpoint
CREATE TABLE "skill_category_i18n" (
	"category_slug" text NOT NULL,
	"locale" "locale" NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	CONSTRAINT "skill_category_i18n_category_slug_locale_pk" PRIMARY KEY("category_slug","locale")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience" ADD CONSTRAINT "experience_logo_media_id_media_id_fk" FOREIGN KEY ("logo_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_i18n" ADD CONSTRAINT "experience_i18n_experience_id_experience_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experience"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_skill" ADD CONSTRAINT "experience_skill_experience_id_experience_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experience"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_skill" ADD CONSTRAINT "experience_skill_skill_slug_skill_slug_fk" FOREIGN KEY ("skill_slug") REFERENCES "public"."skill"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_avatar_media_id_media_id_fk" FOREIGN KEY ("avatar_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_i18n" ADD CONSTRAINT "profile_i18n_profile_id_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_i18n" ADD CONSTRAINT "profile_i18n_cv_pdf_media_id_media_id_fk" FOREIGN KEY ("cv_pdf_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_video_media_id_media_id_fk" FOREIGN KEY ("video_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_i18n" ADD CONSTRAINT "project_i18n_project_slug_project_slug_fk" FOREIGN KEY ("project_slug") REFERENCES "public"."project"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_skill" ADD CONSTRAINT "project_skill_project_slug_project_slug_fk" FOREIGN KEY ("project_slug") REFERENCES "public"."project"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_skill" ADD CONSTRAINT "project_skill_skill_slug_skill_slug_fk" FOREIGN KEY ("skill_slug") REFERENCES "public"."skill"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill" ADD CONSTRAINT "skill_category_slug_skill_category_slug_fk" FOREIGN KEY ("category_slug") REFERENCES "public"."skill_category"("slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_category_i18n" ADD CONSTRAINT "skill_category_i18n_category_slug_skill_category_slug_fk" FOREIGN KEY ("category_slug") REFERENCES "public"."skill_category"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "experience_sort_order_idx" ON "experience" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "message_ip_hash_created_idx" ON "message" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "skill_category_idx" ON "skill" USING btree ("category_slug","sort_order");