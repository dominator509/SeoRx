import { z } from "zod";
import {
  GEO_AEO_ISSUE_TYPES,
  GEO_AEO_PROMPT_INTENTS,
  GEO_AEO_SURFACES,
} from "./constants";

export const geoPackageTierSchema = z.enum(["basic", "standard", "premium", "custom"]);

export const geoCompetitorSchema = z.object({
  name: z.string().trim().max(120).optional(),
  url: z.string().url(),
});

export const geoAuditProfileInputSchema = z.object({
  businessName: z.string().trim().min(1).max(200),
  websiteUrl: z.string().url(),
  primaryOffer: z.string().trim().max(300).optional(),
  targetLocations: z.array(z.string().trim().max(120)).max(25).default([]),
  targetServices: z.array(z.string().trim().max(160)).max(50).default([]),
  targetCustomers: z.array(z.string().trim().max(160)).max(50).default([]),
  competitors: z.array(geoCompetitorSchema).max(10).default([]),
  proofPoints: z.array(z.string().trim().max(300)).max(50).default([]),
  reviewsUrl: z.string().url().optional().or(z.literal("")),
  googleBusinessUrl: z.string().url().optional().or(z.literal("")),
  importantPages: z.array(z.string().url()).max(50).default([]),
  customerQuestions: z.array(z.string().trim().max(300)).max(100).default([]),
  knownFor: z.string().trim().max(300).optional(),
  packageTier: geoPackageTierSchema.default("standard"),
});

export const geoPromptIntentSchema = z.enum(GEO_AEO_PROMPT_INTENTS);

export const geoPromptItemSchema = z.object({
  promptText: z.string().trim().min(1).max(500),
  intent: geoPromptIntentSchema,
  targetService: z.string().trim().max(160).optional(),
  targetLocation: z.string().trim().max(120).optional(),
  buyerStage: z.enum(["awareness", "consideration", "decision", "retention", "unknown"]).default("unknown"),
  priority: z.number().int().min(1).max(100).default(50),
});

export const geoVisibilityObservationInputSchema = z.object({
  promptId: z.string().optional(),
  surface: z.enum(GEO_AEO_SURFACES),
  observedAt: z.string().datetime().optional(),
  brandMentioned: z.boolean().default(false),
  brandCited: z.boolean().default(false),
  brandPosition: z.number().int().positive().optional(),
  sentiment: z.enum(["positive", "neutral", "negative", "mixed", "unknown"]).default("unknown"),
  answerSummary: z.string().trim().max(2000).optional(),
  citedUrls: z.array(z.string().url()).max(50).default([]),
  competitorsMentioned: z.array(z.string().trim().max(200)).max(50).default([]),
  rawAnswerExcerpt: z.string().trim().max(5000).optional(),
  confidenceScore: z.number().int().min(0).max(100).default(50),
  notes: z.string().trim().max(2000).optional(),
});

export const geoIssueTypeSchema = z.enum(GEO_AEO_ISSUE_TYPES);

export const geoRecommendationInputSchema = z.object({
  pageUrl: z.string().url().optional(),
  category: z.string().trim().min(1).max(120),
  issueType: geoIssueTypeSchema,
  title: z.string().trim().min(1).max(200),
  evidence: z.string().trim().min(1).max(2000),
  recommendation: z.string().trim().min(1).max(2000),
  aiVisibilityImpact: z.string().trim().max(1000).optional(),
  businessImpact: z.string().trim().max(1000).optional(),
  priorityScore: z.number().int().min(0).max(100),
  estimatedEffort: z.enum(["low", "medium", "high"]).optional(),
  owner: z.enum(["business_owner", "content_writer", "developer", "seo_specialist", "agency"]).optional(),
  fiverrPackageTier: geoPackageTierSchema.optional(),
  status: z.enum(["draft", "approved", "hidden"]).default("draft"),
});

export type GeoAuditProfileInput = z.input<typeof geoAuditProfileInputSchema>;
export type GeoAuditProfile = z.output<typeof geoAuditProfileInputSchema>;
export type GeoPackageTier = z.infer<typeof geoPackageTierSchema>;
export type GeoPromptItem = z.infer<typeof geoPromptItemSchema>;
export type GeoVisibilityObservationInput = z.infer<typeof geoVisibilityObservationInputSchema>;
export type GeoRecommendationInput = z.infer<typeof geoRecommendationInputSchema>;
