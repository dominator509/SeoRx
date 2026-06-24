export const GEO_AEO_FEATURE_FLAGS = {
  enabled: process.env.GEO_AEO_ENABLED === "true",
  realPlatformChecks: process.env.GEO_AEO_REAL_PLATFORM_CHECKS === "true",
  manualObservations: process.env.GEO_AEO_MANUAL_OBSERVATIONS !== "false",
  defaultPromptCount: numberFromEnv("GEO_AEO_DEFAULT_PROMPT_COUNT", 25),
  maxCompetitors: numberFromEnv("GEO_AEO_MAX_COMPETITORS", 5),
  maxPagesBasic: numberFromEnv("GEO_AEO_MAX_PAGES_BASIC", 5),
  maxPagesStandard: numberFromEnv("GEO_AEO_MAX_PAGES_STANDARD", 10),
  maxPagesPremium: numberFromEnv("GEO_AEO_MAX_PAGES_PREMIUM", 25),
} as const;

export const GEO_AEO_AUDIT_TYPES = {
  seo: "seo",
  geoAeo: "geo_aeo",
  hybrid: "hybrid",
} as const;

export const GEO_AEO_REPORT_TYPES = {
  seoAudit: "seo_audit",
  geoAeoAudit: "geo_aeo_audit",
  hybridAudit: "hybrid_audit",
  retainerProposal: "retainer_proposal",
} as const;

export const GEO_AEO_SURFACES = [
  "chatgpt",
  "gemini",
  "perplexity",
  "google_ai_overviews",
  "google_ai_mode",
  "copilot",
  "claude",
  "manual_observation",
  "simulated_retrieval",
] as const;

export const GEO_AEO_PROMPT_INTENTS = [
  "discovery",
  "local_service",
  "comparison",
  "best_provider",
  "pricing",
  "problem_solution",
  "faq",
  "alternative",
  "trust_validation",
] as const;

export const GEO_AEO_ISSUE_TYPES = [
  "AI_VISIBILITY_ZERO_BASELINE",
  "WEAK_ENTITY_DEFINITION",
  "UNCLEAR_SERVICE_POSITIONING",
  "MISSING_DIRECT_ANSWER_BLOCKS",
  "WEAK_FAQ_COVERAGE",
  "MISSING_SCHEMA_FOR_AI_CONTEXT",
  "WEAK_SOURCEABLE_CLAIMS",
  "NO_PROOF_OR_CASE_STUDIES",
  "COMPETITOR_OWNS_AI_PROMPT",
  "MISSING_COMPARISON_CONTENT",
  "MISSING_SERVICE_PAGE",
  "MISSING_LOCATION_PAGE",
  "INCONSISTENT_BRAND_ENTITY",
  "LOW_EXTERNAL_CITATION_COVERAGE",
  "AI_CRAWLABILITY_RISK",
  "GENERIC_COMMODITY_CONTENT",
  "WEAK_AUTHOR_OR_ORGANIZATION_TRUST",
  "MISSING_REVIEW_OR_TESTIMONIAL_PROOF",
  "MISSING_SAME_AS_OR_ENTITY_LINKS",
  "PROMPT_INTENT_GAP",
] as const;

export const GEO_AEO_FIVERR_PACKAGES = {
  basic: {
    key: "basic",
    name: "AI Visibility Snapshot",
    pages: GEO_AEO_FEATURE_FLAGS.maxPagesBasic,
    prompts: 10,
    competitors: 2,
    includes: [
      "AI visibility score",
      "Top GEO/AEO blockers",
      "Basic prompt set",
      "PDF or Markdown report",
      "30-day quick-win plan",
    ],
  },
  standard: {
    key: "standard",
    name: "GEO/AEO Audit + Competitor Gap",
    pages: GEO_AEO_FEATURE_FLAGS.maxPagesStandard,
    prompts: GEO_AEO_FEATURE_FLAGS.defaultPromptCount,
    competitors: 3,
    includes: [
      "Everything in Basic",
      "Competitor comparison",
      "FAQ/schema recommendations",
      "AI-citable page recommendations",
      "Priority fix list",
    ],
  },
  premium: {
    key: "premium",
    name: "Full AI Visibility Roadmap",
    pages: GEO_AEO_FEATURE_FLAGS.maxPagesPremium,
    prompts: 50,
    competitors: GEO_AEO_FEATURE_FLAGS.maxCompetitors,
    includes: [
      "Everything in Standard",
      "Service page outlines",
      "Citation/source roadmap",
      "Developer-ready task list",
      "Implementation plan",
      "Monthly monitoring proposal",
    ],
  },
} as const;

export type GeoAeoPackageTier = keyof typeof GEO_AEO_FIVERR_PACKAGES;
export type GeoAeoIssueType = (typeof GEO_AEO_ISSUE_TYPES)[number];
export type GeoAeoPromptIntent = (typeof GEO_AEO_PROMPT_INTENTS)[number];
export type GeoAeoSurface = (typeof GEO_AEO_SURFACES)[number];

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
