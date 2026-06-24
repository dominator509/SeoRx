import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { auditsTable } from "./audits";

export const aiVisibilitySurfaceEnum = pgEnum("ai_visibility_surface", [
  "chatgpt",
  "gemini",
  "perplexity",
  "google_ai_overviews",
  "google_ai_mode",
  "copilot",
  "claude",
  "manual_observation",
  "simulated_retrieval",
]);

export const geoPromptIntentEnum = pgEnum("geo_prompt_intent", [
  "discovery",
  "local_service",
  "comparison",
  "best_provider",
  "pricing",
  "problem_solution",
  "faq",
  "alternative",
  "trust_validation",
]);

export const geoAuditProfilesTable = pgTable(
  "geo_audit_profiles",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    auditId: text("audit_id")
      .notNull()
      .references(() => auditsTable.id, { onDelete: "cascade" }),
    businessName: text("business_name").notNull(),
    websiteUrl: text("website_url").notNull(),
    primaryOffer: text("primary_offer"),
    targetLocations: jsonb("target_locations"),
    targetServices: jsonb("target_services"),
    targetCustomers: jsonb("target_customers"),
    competitors: jsonb("competitors"),
    proofPoints: jsonb("proof_points"),
    reviewsUrl: text("reviews_url"),
    googleBusinessUrl: text("google_business_url"),
    importantPages: jsonb("important_pages"),
    customerQuestions: jsonb("customer_questions"),
    knownFor: text("known_for"),
    packageTier: text("package_tier").notNull().default("standard"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    auditIdx: index("geo_audit_profiles_audit_id_idx").on(table.auditId),
  }),
);

export const geoPromptsTable = pgTable(
  "geo_prompts",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    auditId: text("audit_id")
      .notNull()
      .references(() => auditsTable.id, { onDelete: "cascade" }),
    promptText: text("prompt_text").notNull(),
    intent: geoPromptIntentEnum("intent").notNull(),
    targetService: text("target_service"),
    targetLocation: text("target_location"),
    buyerStage: text("buyer_stage"),
    priority: integer("priority").notNull().default(50),
    approved: boolean("approved").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    auditIdx: index("geo_prompts_audit_id_idx").on(table.auditId),
    intentIdx: index("geo_prompts_intent_idx").on(table.intent),
  }),
);

export const geoVisibilityObservationsTable = pgTable(
  "geo_visibility_observations",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    auditId: text("audit_id")
      .notNull()
      .references(() => auditsTable.id, { onDelete: "cascade" }),
    promptId: text("prompt_id").references(() => geoPromptsTable.id, { onDelete: "set null" }),
    surface: aiVisibilitySurfaceEnum("surface").notNull(),
    observedAt: timestamp("observed_at").notNull().defaultNow(),
    brandMentioned: boolean("brand_mentioned").notNull().default(false),
    brandCited: boolean("brand_cited").notNull().default(false),
    brandPosition: integer("brand_position"),
    sentiment: text("sentiment"),
    answerSummary: text("answer_summary"),
    citedUrls: jsonb("cited_urls"),
    competitorsMentioned: jsonb("competitors_mentioned"),
    rawAnswerExcerpt: text("raw_answer_excerpt"),
    confidenceScore: integer("confidence_score").notNull().default(50),
    observationMode: text("observation_mode").notNull().default("manual"),
    notes: text("notes"),
    approved: boolean("approved").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    auditIdx: index("geo_visibility_observations_audit_id_idx").on(table.auditId),
    promptIdx: index("geo_visibility_observations_prompt_id_idx").on(table.promptId),
    surfaceIdx: index("geo_visibility_observations_surface_idx").on(table.surface),
  }),
);

export const geoPageAssessmentsTable = pgTable(
  "geo_page_assessments",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    auditId: text("audit_id")
      .notNull()
      .references(() => auditsTable.id, { onDelete: "cascade" }),
    pageUrl: text("page_url").notNull(),
    aiCitableScore: integer("ai_citable_score").notNull(),
    answerCoverageScore: integer("answer_coverage_score").notNull(),
    entityClarityScore: integer("entity_clarity_score").notNull(),
    proofSignalScore: integer("proof_signal_score").notNull(),
    structureScore: integer("structure_score").notNull(),
    schemaReadinessScore: integer("schema_readiness_score").notNull(),
    citationReadinessScore: integer("citation_readiness_score").notNull(),
    detectedGaps: jsonb("detected_gaps"),
    recommendedFixes: jsonb("recommended_fixes"),
    evidence: jsonb("evidence"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    auditIdx: index("geo_page_assessments_audit_id_idx").on(table.auditId),
    pageUrlIdx: index("geo_page_assessments_page_url_idx").on(table.pageUrl),
  }),
);

export const geoRecommendationsTable = pgTable(
  "geo_recommendations",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    auditId: text("audit_id")
      .notNull()
      .references(() => auditsTable.id, { onDelete: "cascade" }),
    pageUrl: text("page_url"),
    category: text("category").notNull(),
    issueType: text("issue_type").notNull(),
    title: text("title").notNull(),
    evidence: text("evidence").notNull(),
    recommendation: text("recommendation").notNull(),
    aiVisibilityImpact: text("ai_visibility_impact"),
    businessImpact: text("business_impact"),
    priorityScore: integer("priority_score").notNull(),
    estimatedEffort: text("estimated_effort"),
    owner: text("owner"),
    fiverrPackageTier: text("fiverr_package_tier"),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    auditIdx: index("geo_recommendations_audit_id_idx").on(table.auditId),
    pageUrlIdx: index("geo_recommendations_page_url_idx").on(table.pageUrl),
    statusIdx: index("geo_recommendations_status_idx").on(table.status),
  }),
);

export const geoScoreSnapshotsTable = pgTable(
  "geo_score_snapshots",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    auditId: text("audit_id")
      .notNull()
      .references(() => auditsTable.id, { onDelete: "cascade" }),
    aiVisibilityScore: integer("ai_visibility_score").notNull(),
    grade: text("grade").notNull(),
    subScores: jsonb("sub_scores").notNull(),
    topRisks: jsonb("top_risks"),
    quickWins: jsonb("quick_wins"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    auditIdx: index("geo_score_snapshots_audit_id_idx").on(table.auditId),
  }),
);

export const insertGeoAuditProfileSchema = createInsertSchema(geoAuditProfilesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertGeoPromptSchema = createInsertSchema(geoPromptsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertGeoVisibilityObservationSchema = createInsertSchema(geoVisibilityObservationsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertGeoPageAssessmentSchema = createInsertSchema(geoPageAssessmentsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertGeoRecommendationSchema = createInsertSchema(geoRecommendationsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertGeoScoreSnapshotSchema = createInsertSchema(geoScoreSnapshotsTable).omit({
  createdAt: true,
});

export type InsertGeoAuditProfile = z.infer<typeof insertGeoAuditProfileSchema>;
export type GeoAuditProfile = typeof geoAuditProfilesTable.$inferSelect;
export type InsertGeoPrompt = z.infer<typeof insertGeoPromptSchema>;
export type GeoPrompt = typeof geoPromptsTable.$inferSelect;
export type InsertGeoVisibilityObservation = z.infer<typeof insertGeoVisibilityObservationSchema>;
export type GeoVisibilityObservation = typeof geoVisibilityObservationsTable.$inferSelect;
export type InsertGeoPageAssessment = z.infer<typeof insertGeoPageAssessmentSchema>;
export type GeoPageAssessment = typeof geoPageAssessmentsTable.$inferSelect;
export type InsertGeoRecommendation = z.infer<typeof insertGeoRecommendationSchema>;
export type GeoRecommendation = typeof geoRecommendationsTable.$inferSelect;
export type InsertGeoScoreSnapshot = z.infer<typeof insertGeoScoreSnapshotSchema>;
export type GeoScoreSnapshot = typeof geoScoreSnapshotsTable.$inferSelect;
