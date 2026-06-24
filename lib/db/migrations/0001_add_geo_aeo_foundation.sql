CREATE TYPE "public"."audit_type" AS ENUM('seo', 'geo_aeo', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('seo_audit', 'geo_aeo_audit', 'hybrid_audit', 'retainer_proposal');--> statement-breakpoint
CREATE TYPE "public"."ai_visibility_surface" AS ENUM('chatgpt', 'gemini', 'perplexity', 'google_ai_overviews', 'google_ai_mode', 'copilot', 'claude', 'manual_observation', 'simulated_retrieval');--> statement-breakpoint
CREATE TYPE "public"."geo_prompt_intent" AS ENUM('discovery', 'local_service', 'comparison', 'best_provider', 'pricing', 'problem_solution', 'faq', 'alternative', 'trust_validation');--> statement-breakpoint
ALTER TYPE "public"."issue_category" ADD VALUE 'ai_answer_coverage';--> statement-breakpoint
ALTER TYPE "public"."issue_category" ADD VALUE 'entity_clarity';--> statement-breakpoint
ALTER TYPE "public"."issue_category" ADD VALUE 'ai_citable_structure';--> statement-breakpoint
ALTER TYPE "public"."issue_category" ADD VALUE 'proof_trust';--> statement-breakpoint
ALTER TYPE "public"."issue_category" ADD VALUE 'competitor_gap';--> statement-breakpoint
ALTER TYPE "public"."issue_category" ADD VALUE 'service_location_gap';--> statement-breakpoint
ALTER TYPE "public"."issue_category" ADD VALUE 'citation_readiness';--> statement-breakpoint
CREATE TABLE "geo_audit_profiles" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"audit_id" text NOT NULL,
	"business_name" text NOT NULL,
	"website_url" text NOT NULL,
	"primary_offer" text,
	"target_locations" jsonb,
	"target_services" jsonb,
	"target_customers" jsonb,
	"competitors" jsonb,
	"proof_points" jsonb,
	"reviews_url" text,
	"google_business_url" text,
	"important_pages" jsonb,
	"customer_questions" jsonb,
	"known_for" text,
	"package_tier" text DEFAULT 'standard' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_page_assessments" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"audit_id" text NOT NULL,
	"page_url" text NOT NULL,
	"ai_citable_score" integer NOT NULL,
	"answer_coverage_score" integer NOT NULL,
	"entity_clarity_score" integer NOT NULL,
	"proof_signal_score" integer NOT NULL,
	"structure_score" integer NOT NULL,
	"schema_readiness_score" integer NOT NULL,
	"citation_readiness_score" integer NOT NULL,
	"detected_gaps" jsonb,
	"recommended_fixes" jsonb,
	"evidence" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_prompts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"audit_id" text NOT NULL,
	"prompt_text" text NOT NULL,
	"intent" "geo_prompt_intent" NOT NULL,
	"target_service" text,
	"target_location" text,
	"buyer_stage" text,
	"priority" integer DEFAULT 50 NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_recommendations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"audit_id" text NOT NULL,
	"page_url" text,
	"category" text NOT NULL,
	"issue_type" text NOT NULL,
	"title" text NOT NULL,
	"evidence" text NOT NULL,
	"recommendation" text NOT NULL,
	"ai_visibility_impact" text,
	"business_impact" text,
	"priority_score" integer NOT NULL,
	"estimated_effort" text,
	"owner" text,
	"fiverr_package_tier" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_score_snapshots" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"audit_id" text NOT NULL,
	"ai_visibility_score" integer NOT NULL,
	"grade" text NOT NULL,
	"sub_scores" jsonb NOT NULL,
	"top_risks" jsonb,
	"quick_wins" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_visibility_observations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"audit_id" text NOT NULL,
	"prompt_id" text,
	"surface" "ai_visibility_surface" NOT NULL,
	"observed_at" timestamp DEFAULT now() NOT NULL,
	"brand_mentioned" boolean DEFAULT false NOT NULL,
	"brand_cited" boolean DEFAULT false NOT NULL,
	"brand_position" integer,
	"sentiment" text,
	"answer_summary" text,
	"cited_urls" jsonb,
	"competitors_mentioned" jsonb,
	"raw_answer_excerpt" text,
	"confidence_score" integer DEFAULT 50 NOT NULL,
	"observation_mode" text DEFAULT 'manual' NOT NULL,
	"notes" text,
	"approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_issues" ADD COLUMN "issue_type" text;--> statement-breakpoint
ALTER TABLE "audit_issues" ADD COLUMN "evidence" jsonb;--> statement-breakpoint
ALTER TABLE "audit_issues" ADD COLUMN "ai_visibility_impact" text;--> statement-breakpoint
ALTER TABLE "audit_issues" ADD COLUMN "business_impact" text;--> statement-breakpoint
ALTER TABLE "audit_issues" ADD COLUMN "estimated_effort" text;--> statement-breakpoint
ALTER TABLE "audit_issues" ADD COLUMN "recommended_owner" text;--> statement-breakpoint
ALTER TABLE "audits" ADD COLUMN "audit_type" "audit_type" DEFAULT 'seo' NOT NULL;--> statement-breakpoint
ALTER TABLE "audits" ADD COLUMN "ai_visibility_score" real;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "report_type" "report_type" DEFAULT 'seo_audit' NOT NULL;--> statement-breakpoint
ALTER TABLE "geo_audit_profiles" ADD CONSTRAINT "geo_audit_profiles_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_page_assessments" ADD CONSTRAINT "geo_page_assessments_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_prompts" ADD CONSTRAINT "geo_prompts_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_recommendations" ADD CONSTRAINT "geo_recommendations_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_score_snapshots" ADD CONSTRAINT "geo_score_snapshots_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_visibility_observations" ADD CONSTRAINT "geo_visibility_observations_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_visibility_observations" ADD CONSTRAINT "geo_visibility_observations_prompt_id_geo_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."geo_prompts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "geo_audit_profiles_audit_id_idx" ON "geo_audit_profiles" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "geo_page_assessments_audit_id_idx" ON "geo_page_assessments" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "geo_page_assessments_page_url_idx" ON "geo_page_assessments" USING btree ("page_url");--> statement-breakpoint
CREATE INDEX "geo_prompts_audit_id_idx" ON "geo_prompts" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "geo_prompts_intent_idx" ON "geo_prompts" USING btree ("intent");--> statement-breakpoint
CREATE INDEX "geo_recommendations_audit_id_idx" ON "geo_recommendations" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "geo_recommendations_page_url_idx" ON "geo_recommendations" USING btree ("page_url");--> statement-breakpoint
CREATE INDEX "geo_recommendations_status_idx" ON "geo_recommendations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "geo_score_snapshots_audit_id_idx" ON "geo_score_snapshots" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "geo_visibility_observations_audit_id_idx" ON "geo_visibility_observations" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "geo_visibility_observations_prompt_id_idx" ON "geo_visibility_observations" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX "geo_visibility_observations_surface_idx" ON "geo_visibility_observations" USING btree ("surface");