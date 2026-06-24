import * as cheerio from "cheerio";
import type { CrawledPage, CrawlResult } from "../crawler";
import type { GeoAeoIssueType } from "./constants";
import type { GeoAuditProfileInput } from "./schemas";
import type { GeoPageAssessmentInput } from "./scoring";

export type GeoIssueCategory =
  | "ai_answer_coverage"
  | "entity_clarity"
  | "ai_citable_structure"
  | "proof_trust"
  | "structured_data"
  | "crawlability"
  | "competitor_gap"
  | "service_location_gap"
  | "citation_readiness";

export interface GeoScannerIssue {
  url: string;
  category: GeoIssueCategory;
  issueType: GeoAeoIssueType;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  evidence: {
    scanner: string;
    signals: string[];
    excerpt?: string;
  };
  recommendation: string;
  aiVisibilityImpact: string;
  businessImpact: string;
  estimatedEffort: "low" | "medium" | "high";
  recommendedOwner: "business_owner" | "content_writer" | "developer" | "seo_specialist" | "agency";
  priorityScore: number;
}

export interface GeoPageAssessment extends GeoPageAssessmentInput {
  pageUrl: string;
  detectedGaps: string[];
  recommendedFixes: string[];
  evidence: string[];
}

export interface GeoScannerResult {
  issues: GeoScannerIssue[];
  pageAssessments: GeoPageAssessment[];
}

interface PageContext {
  page: CrawledPage;
  text: string;
  lowerText: string;
  title: string;
  headings: string[];
  schemaText: string;
  externalLinks: string[];
}

export function runGeoAeoScanners(input: {
  crawlResult: CrawlResult;
  profile: GeoAuditProfileInput;
}): GeoScannerResult {
  const validPages = input.crawlResult.pages.filter((page) => !page.error && page.statusCode >= 200 && page.statusCode < 400);
  const contexts = validPages.map(pageContext);
  const issues = dedupeIssues([
    ...contexts.flatMap((context) => scanEntityClarity(context, input.profile)),
    ...contexts.flatMap((context) => scanAnswerCoverage(context)),
    ...contexts.flatMap((context) => scanCitableStructure(context)),
    ...contexts.flatMap((context) => scanSourceableClaims(context)),
    ...contexts.flatMap((context) => scanSchemaReadiness(context)),
    ...contexts.flatMap((context) => scanCitationReadiness(context)),
    ...contexts.flatMap((context) => scanCompetitorContent(context, input.profile)),
    ...scanServicePageGaps(contexts, input.profile),
    ...scanCrawlability(input.crawlResult),
  ]);

  return {
    issues,
    pageAssessments: contexts.map((context) => assessPage(context, issues.filter((issue) => issue.url === context.page.url))),
  };
}

function scanEntityClarity(context: PageContext, profile: GeoAuditProfileInput): GeoScannerIssue[] {
  const businessName = profile.businessName.trim();
  const services = profile.targetServices ?? [];
  const mentionsBusiness = includesLoose(context.lowerText, businessName);
  const mentionsService = services.length === 0 || services.some((service) => includesLoose(context.lowerText, service));
  const issues: GeoScannerIssue[] = [];

  if (!mentionsBusiness) {
    issues.push(makeIssue(context, {
      scanner: "entity-clarity",
      category: "entity_clarity",
      issueType: "WEAK_ENTITY_DEFINITION",
      severity: "high",
      title: "Business entity is not clearly named on the page",
      description: "AI answer systems need clear entity references before they can confidently summarize or cite a business.",
      signals: [`Expected business name: ${businessName}`],
      recommendation: "Add a clear business/entity statement near the top of the page and in supporting metadata.",
      aiVisibilityImpact: "Weak entity clarity reduces the chance that answer systems connect this page to the business.",
      businessImpact: "Buyers may not understand who provides the service or why the page is relevant.",
      estimatedEffort: "low",
      recommendedOwner: "content_writer",
      priorityScore: 82,
    }));
  }

  if (!mentionsService) {
    issues.push(makeIssue(context, {
      scanner: "entity-clarity",
      category: "entity_clarity",
      issueType: "UNCLEAR_SERVICE_POSITIONING",
      severity: "medium",
      title: "Target service positioning is unclear",
      description: "The page does not clearly connect the business to the target service terms from the intake profile.",
      signals: services.slice(0, 5).map((service) => `Missing service signal: ${service}`),
      recommendation: "Add direct service language in the H1, intro copy, and relevant sections.",
      aiVisibilityImpact: "Weak service language makes the page harder to retrieve for buyer-intent prompts.",
      businessImpact: "Potential buyers may not see a direct match for their need.",
      estimatedEffort: "low",
      recommendedOwner: "content_writer",
      priorityScore: 72,
    }));
  }

  return issues;
}

function scanAnswerCoverage(context: PageContext): GeoScannerIssue[] {
  const questionHeadings = context.headings.filter((heading) => /\?$|^(who|what|when|where|why|how|is|can|does|do)\b/i.test(heading));
  const hasFaqSchema = /"@type"\s*:\s*"FAQPage"/i.test(context.schemaText);
  const hasDirectAnswer = /\b(provides|offers|specializes in|serves|helps|is a|are a)\b/i.test(context.text.slice(0, 1200));
  const issues: GeoScannerIssue[] = [];

  if (!hasDirectAnswer) {
    issues.push(makeIssue(context, {
      scanner: "ai-answer-coverage",
      category: "ai_answer_coverage",
      issueType: "MISSING_DIRECT_ANSWER_BLOCKS",
      severity: "high",
      title: "Missing direct answer block near the top of the page",
      description: "The page does not provide a concise answer-style summary that can be reused in AI answer contexts.",
      signals: ["No direct answer pattern found in the first 1,200 characters."],
      recommendation: "Add a 2-4 sentence direct answer block that names the business, service, audience, and location.",
      aiVisibilityImpact: "Answer systems have less extractable copy for summaries and citations.",
      businessImpact: "Buyers get less immediate clarity about fit and next steps.",
      estimatedEffort: "low",
      recommendedOwner: "content_writer",
      priorityScore: 84,
    }));
  }

  if (!hasFaqSchema && questionHeadings.length < 2) {
    issues.push(makeIssue(context, {
      scanner: "ai-answer-coverage",
      category: "ai_answer_coverage",
      issueType: "WEAK_FAQ_COVERAGE",
      severity: "medium",
      title: "FAQ and buyer-question coverage is weak",
      description: "The page has limited question-led content or FAQ schema for common buyer prompts.",
      signals: [`Question-style headings found: ${questionHeadings.length}`],
      recommendation: "Add FAQs that answer pricing, fit, process, comparison, and trust questions.",
      aiVisibilityImpact: "Weak FAQ coverage limits prompt-intent matching.",
      businessImpact: "Buyers may leave with unresolved objections.",
      estimatedEffort: "medium",
      recommendedOwner: "content_writer",
      priorityScore: 70,
    }));
  }

  return issues;
}

function scanCitableStructure(context: PageContext): GeoScannerIssue[] {
  if (context.page.wordCount >= 500 && context.page.h2Tags.length >= 3) return [];
  return [makeIssue(context, {
    scanner: "ai-citable-content",
    category: "ai_citable_structure",
    issueType: "GENERIC_COMMODITY_CONTENT",
    severity: context.page.wordCount < 250 ? "high" : "medium",
    title: "Page structure is thin for AI-citable summaries",
    description: "The page lacks enough structured, specific content for answer systems to extract useful evidence.",
    signals: [`Word count: ${context.page.wordCount}`, `H2 count: ${context.page.h2Tags.length}`],
    recommendation: "Expand the page with specific sections, proof, FAQs, service details, and implementation context.",
    aiVisibilityImpact: "Thin pages are less useful as source material for generated answers.",
    businessImpact: "The page may fail to differentiate the business from generic competitors.",
    estimatedEffort: "medium",
    recommendedOwner: "content_writer",
    priorityScore: context.page.wordCount < 250 ? 86 : 68,
  })];
}

function scanSourceableClaims(context: PageContext): GeoScannerIssue[] {
  const proofTerms = ["review", "testimonial", "case study", "licensed", "certified", "award", "years", "portfolio", "guarantee"];
  const proofSignals = proofTerms.filter((term) => context.lowerText.includes(term));
  if (proofSignals.length >= 2) return [];
  return [makeIssue(context, {
    scanner: "sourceable-claims",
    category: "proof_trust",
    issueType: "NO_PROOF_OR_CASE_STUDIES",
    severity: "medium",
    title: "Proof and trust signals are weak",
    description: "The page makes limited sourceable claims that would help an answer engine justify mentioning the business.",
    signals: [`Proof signals found: ${proofSignals.length ? proofSignals.join(", ") : "none"}`],
    recommendation: "Add reviews, testimonials, case studies, credentials, years in business, or other verifiable proof.",
    aiVisibilityImpact: "Answer engines have fewer trust signals to cite or summarize.",
    businessImpact: "Buyers have less evidence to support a decision.",
    estimatedEffort: "medium",
    recommendedOwner: "business_owner",
    priorityScore: 66,
  })];
}

function scanSchemaReadiness(context: PageContext): GeoScannerIssue[] {
  const schema = context.schemaText;
  const hasUsefulSchema = /(Organization|LocalBusiness|Service|FAQPage|Product|Review|BreadcrumbList)/i.test(schema);
  if (hasUsefulSchema) return [];
  return [makeIssue(context, {
    scanner: "geo-schema-readiness",
    category: "structured_data",
    issueType: "MISSING_SCHEMA_FOR_AI_CONTEXT",
    severity: "medium",
    title: "Missing structured data for AI context",
    description: "The page does not include schema types that clarify organization, service, FAQ, product, or page context.",
    signals: [`Structured data blocks: ${context.page.structuredData.length}`],
    recommendation: "Add evidence-backed Organization, LocalBusiness, Service, FAQPage, BreadcrumbList, or Product schema as appropriate.",
    aiVisibilityImpact: "Missing schema reduces machine-readable context for retrieval and summarization.",
    businessImpact: "Important business details may be harder for search systems to interpret consistently.",
    estimatedEffort: "medium",
    recommendedOwner: "developer",
    priorityScore: 64,
  })];
}

function scanCitationReadiness(context: PageContext): GeoScannerIssue[] {
  const hasSameAs = /"sameAs"\s*:/i.test(context.schemaText);
  const hasExternalSource = context.externalLinks.length > 0;
  if (hasSameAs || hasExternalSource) return [];
  return [makeIssue(context, {
    scanner: "citation-readiness",
    category: "citation_readiness",
    issueType: "LOW_EXTERNAL_CITATION_COVERAGE",
    severity: "low",
    title: "External citation and source signals are limited",
    description: "The page does not expose sameAs schema or outbound references to credible third-party profiles.",
    signals: ["No sameAs schema found.", "No external links found."],
    recommendation: "Add sameAs profile links and cite credible third-party profiles or review sources where appropriate.",
    aiVisibilityImpact: "Answer systems have fewer corroborating source signals for the business entity.",
    businessImpact: "Trust-building source paths are less visible to buyers.",
    estimatedEffort: "low",
    recommendedOwner: "seo_specialist",
    priorityScore: 42,
  })];
}

function scanCompetitorContent(context: PageContext, profile: GeoAuditProfileInput): GeoScannerIssue[] {
  if (!profile.competitors?.length) return [];
  const hasComparison = /\b(compare|versus|vs\.?|alternative|competitor)\b/i.test(context.text);
  if (hasComparison) return [];
  return [makeIssue(context, {
    scanner: "competitor-answer-gap",
    category: "competitor_gap",
    issueType: "MISSING_COMPARISON_CONTENT",
    severity: "low",
    title: "Comparison content is missing",
    description: "The intake profile includes competitors, but the page does not answer comparison or alternative prompts.",
    signals: profile.competitors.slice(0, 5).map((competitor) => `Competitor: ${competitor.name ?? competitor.url}`),
    recommendation: "Create evidence-backed comparison or alternative content where it is fair and useful.",
    aiVisibilityImpact: "Comparison prompts may be answered using competitor-owned content instead.",
    businessImpact: "Decision-stage buyers may not find a clear reason to choose this business.",
    estimatedEffort: "medium",
    recommendedOwner: "content_writer",
    priorityScore: 54,
  })];
}

function scanServicePageGaps(contexts: PageContext[], profile: GeoAuditProfileInput): GeoScannerIssue[] {
  const services = profile.targetServices ?? [];
  if (!services.length || !contexts.length) return [];
  const siteText = contexts.map((context) => context.lowerText).join(" ");
  const missingServices = services.filter((service) => !includesLoose(siteText, service));
  if (!missingServices.length) return [];
  const home = contexts[0];
  return missingServices.map((service) => makeIssue(home, {
    scanner: "service-page-gap",
    category: "service_location_gap",
    issueType: "MISSING_SERVICE_PAGE",
    severity: "medium",
    title: `Missing clear service coverage for ${service}`,
    description: "The crawl did not find a clear page or section covering a target service from the intake profile.",
    signals: [`Missing service: ${service}`],
    recommendation: "Create or strengthen a dedicated service page with direct answers, FAQs, proof, and schema.",
    aiVisibilityImpact: "Missing service coverage limits retrieval for service-specific buyer prompts.",
    businessImpact: "Qualified buyers may not find a page that matches their exact need.",
    estimatedEffort: "medium",
    recommendedOwner: "content_writer",
    priorityScore: 76,
  }));
}

function scanCrawlability(result: CrawlResult): GeoScannerIssue[] {
  const issues: GeoScannerIssue[] = [];
  for (const blockedUrl of result.blockedByRobots) {
    issues.push({
      url: blockedUrl,
      category: "crawlability",
      issueType: "AI_CRAWLABILITY_RISK",
      severity: "medium",
      title: "Important URL may be blocked from crawlers",
      description: "A URL was blocked by robots.txt during crawl, which can prevent search and answer systems from using it.",
      evidence: { scanner: "ai-crawlability", signals: ["Blocked by robots.txt"] },
      recommendation: "Review robots.txt and unblock important commercial or informational pages when appropriate.",
      aiVisibilityImpact: "Blocked pages cannot contribute reliable evidence to answer systems.",
      businessImpact: "Important content may be invisible to discovery paths.",
      estimatedEffort: "low",
      recommendedOwner: "developer",
      priorityScore: 62,
    });
  }
  for (const page of result.pages.filter((item) => item.error || item.statusCode >= 400)) {
    issues.push({
      url: page.url,
      category: "crawlability",
      issueType: "AI_CRAWLABILITY_RISK",
      severity: "high",
      title: "Page returned an error during crawl",
      description: "A crawled page failed or returned an error status.",
      evidence: {
        scanner: "ai-crawlability",
        signals: [`Status: ${page.statusCode}`, page.error ? `Error: ${sanitize(page.error)}` : "HTTP error"],
      },
      recommendation: "Fix server errors, redirects, or timeout conditions for important pages.",
      aiVisibilityImpact: "Unreachable pages cannot be summarized or cited reliably.",
      businessImpact: "Buyers and crawlers may hit dead ends.",
      estimatedEffort: "medium",
      recommendedOwner: "developer",
      priorityScore: 88,
    });
  }
  return issues;
}

function assessPage(context: PageContext, issues: GeoScannerIssue[]): GeoPageAssessment {
  const issuePenalty = Math.min(50, issues.reduce((sum, issue) => sum + severityPenalty(issue.severity), 0));
  return {
    pageUrl: context.page.url,
    aiCitableScore: clampScore(100 - issuePenalty - (context.page.wordCount < 500 ? 15 : 0)),
    answerCoverageScore: clampScore(100 - penaltyForIssue(issues, "ai_answer_coverage")),
    entityClarityScore: clampScore(100 - penaltyForIssue(issues, "entity_clarity")),
    proofSignalScore: clampScore(100 - penaltyForIssue(issues, "proof_trust")),
    structureScore: clampScore(100 - penaltyForIssue(issues, "ai_citable_structure")),
    schemaReadinessScore: clampScore(100 - penaltyForIssue(issues, "structured_data")),
    citationReadinessScore: clampScore(100 - penaltyForIssue(issues, "citation_readiness")),
    crawlabilityScore: clampScore(100 - penaltyForIssue(issues, "crawlability")),
    detectedGaps: issues.map((issue) => issue.title),
    recommendedFixes: issues.map((issue) => issue.recommendation),
    evidence: issues.flatMap((issue) => issue.evidence.signals).slice(0, 10),
  };
}

function pageContext(page: CrawledPage): PageContext {
  const $ = cheerio.load(page.html || "");
  const text = sanitize($("body").text() || [page.title, page.metaDescription, ...page.h1Tags, ...page.h2Tags].filter(Boolean).join(" "));
  const headings = [...page.h1Tags, ...page.h2Tags].map(sanitize).filter(Boolean);
  return {
    page,
    text,
    lowerText: text.toLowerCase(),
    title: page.title ?? "",
    headings,
    schemaText: page.structuredData.join(" "),
    externalLinks: page.links.filter((link) => !link.isInternal).map((link) => link.href),
  };
}

function makeIssue(context: PageContext, input: {
  scanner: string;
  category: GeoIssueCategory;
  issueType: GeoAeoIssueType;
  severity: GeoScannerIssue["severity"];
  title: string;
  description: string;
  signals: string[];
  recommendation: string;
  aiVisibilityImpact: string;
  businessImpact: string;
  estimatedEffort: GeoScannerIssue["estimatedEffort"];
  recommendedOwner: GeoScannerIssue["recommendedOwner"];
  priorityScore: number;
}): GeoScannerIssue {
  return {
    url: context.page.url,
    category: input.category,
    issueType: input.issueType,
    severity: input.severity,
    title: input.title,
    description: input.description,
    evidence: {
      scanner: input.scanner,
      signals: input.signals.map(sanitize),
      excerpt: excerpt(context.text),
    },
    recommendation: input.recommendation,
    aiVisibilityImpact: input.aiVisibilityImpact,
    businessImpact: input.businessImpact,
    estimatedEffort: input.estimatedEffort,
    recommendedOwner: input.recommendedOwner,
    priorityScore: input.priorityScore,
  };
}

function dedupeIssues(issues: GeoScannerIssue[]): GeoScannerIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.url}:${issue.issueType}:${issue.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function includesLoose(text: string, value: string): boolean {
  const normalized = sanitize(value).toLowerCase();
  return normalized.length > 0 && text.includes(normalized);
}

function sanitize(value: string): string {
  return value.replace(/\s+/g, " ").replace(/[<>]/g, "").trim();
}

function excerpt(value: string): string | undefined {
  const sanitized = sanitize(value);
  return sanitized ? sanitized.slice(0, 240) : undefined;
}

function penaltyForIssue(issues: GeoScannerIssue[], category: GeoIssueCategory): number {
  return Math.min(100, issues.filter((issue) => issue.category === category).reduce((sum, issue) => sum + severityPenalty(issue.severity), 0));
}

function severityPenalty(severity: GeoScannerIssue["severity"]): number {
  const penalties = { critical: 45, high: 30, medium: 18, low: 10, info: 4 };
  return penalties[severity];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
