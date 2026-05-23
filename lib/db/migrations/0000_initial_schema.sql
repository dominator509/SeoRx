CREATE TYPE "public"."user_role" AS ENUM('superadmin', 'admin', 'agency', 'client', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."org_member_role" AS ENUM('admin', 'agency', 'client', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."org_plan" AS ENUM('free', 'starter', 'professional', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."audit_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."issue_category" AS ENUM('meta', 'content', 'performance', 'links', 'structured_data', 'mobile', 'security', 'crawlability');--> statement-breakpoint
CREATE TYPE "public"."issue_severity" AS ENUM('critical', 'high', 'medium', 'low', 'info');--> statement-breakpoint
CREATE TYPE "public"."issue_status" AS ENUM('open', 'approved', 'dismissed', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."report_format" AS ENUM('pdf', 'html', 'json');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('generating', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_provider_type" AS ENUM('openai', 'anthropic', 'gemini', 'ollama', 'custom');--> statement-breakpoint
CREATE TYPE "public"."device_type" AS ENUM('mobile', 'desktop');--> statement-breakpoint
CREATE TYPE "public"."integration_provider" AS ENUM('google_search_console');--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"clerk_id" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"avatar_url" text,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
CREATE TABLE "org_members" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"role" "org_member_role" DEFAULT 'viewer' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"plan" "org_plan" DEFAULT 'free' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"org_id" text,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"industry" text,
	"contact_email" text,
	"logo_url" text,
	"seo_score" real,
	"last_audit_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_issues" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"audit_id" text NOT NULL,
	"url" text NOT NULL,
	"category" "issue_category" NOT NULL,
	"severity" "issue_severity" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"recommendation" text,
	"ai_recommendation" text,
	"priority_score" real DEFAULT 0 NOT NULL,
	"status" "issue_status" DEFAULT 'open' NOT NULL,
	"approved_by" text,
	"approved_at" timestamp,
	"affected_element" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audits" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"client_id" text NOT NULL,
	"url" text NOT NULL,
	"status" "audit_status" DEFAULT 'pending' NOT NULL,
	"seo_score" real,
	"page_speed_score" real,
	"crawled_pages" integer DEFAULT 0,
	"scan_duration_ms" integer,
	"max_pages" integer DEFAULT 100,
	"include_page_speed" boolean DEFAULT false,
	"ai_provider_id" text,
	"ai_provider_used" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"audit_id" text NOT NULL,
	"client_id" text NOT NULL,
	"title" text NOT NULL,
	"format" "report_format" DEFAULT 'pdf' NOT NULL,
	"status" "report_status" DEFAULT 'generating' NOT NULL,
	"download_url" text,
	"summary" text,
	"include_ai_summary" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_providers" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"provider" "ai_provider_type" NOT NULL,
	"model" text NOT NULL,
	"encrypted_api_key" text,
	"base_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_speed_results" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"audit_id" text NOT NULL,
	"url" text NOT NULL,
	"device" "device_type" DEFAULT 'mobile' NOT NULL,
	"performance_score" real NOT NULL,
	"accessibility_score" real,
	"best_practices_score" real,
	"seo_score" real,
	"fcp" real,
	"lcp" real,
	"cls" real,
	"fid" integer,
	"tbt" real,
	"ttfb" real,
	"speed_index" real,
	"total_blocking_time" integer,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "org_integrations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"org_id" text NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"encrypted_access_token" text,
	"encrypted_refresh_token" text,
	"token_expires_at" timestamp,
	"scopes" text,
	"metadata" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_webhooks" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"org_id" text NOT NULL,
	"url" text NOT NULL,
	"events" jsonb NOT NULL,
	"encrypted_secret" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_status_code" integer,
	"last_delivered_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_issues" ADD CONSTRAINT "audit_issues_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audits" ADD CONSTRAINT "audits_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_providers" ADD CONSTRAINT "ai_providers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_speed_results" ADD CONSTRAINT "page_speed_results_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_integrations" ADD CONSTRAINT "org_integrations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_webhooks" ADD CONSTRAINT "org_webhooks_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;