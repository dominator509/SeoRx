import type {
  Audit,
  Client,
  GeoAuditProfile,
  GeoPageAssessment,
  GeoPrompt,
  GeoRecommendation,
  GeoScoreSnapshot,
  GeoVisibilityObservation,
} from "@workspace/db";
import {
  auditIssuesTable,
  db,
  geoAuditProfilesTable,
  geoPageAssessmentsTable,
  geoPromptsTable,
  geoRecommendationsTable,
  geoScoreSnapshotsTable,
  geoVisibilityObservationsTable,
  type AuditIssue,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { gradeForScore } from "./scoring";

export interface GeoAeoReportPayload {
  title: "AI Visibility Audit";
  subtitle: string;
  generatedAt: Date;
  client: Pick<Client, "id" | "name" | "domain">;
  audit: Pick<Audit, "id" | "url" | "auditType" | "aiVisibilityScore" | "completedAt" | "crawledPages">;
  profile: GeoAuditProfile | null;
  score: {
    aiVisibilityScore: number;
    grade: string;
    subScores: Record<string, number>;
    topRisks: string[];
    quickWins: string[];
  };
  prompts: GeoPrompt[];
  observations: Array<GeoVisibilityObservation & { promptText?: string | null }>;
  pageAssessments: GeoPageAssessment[];
  recommendations: GeoRecommendation[];
  approvedIssues: AuditIssue[];
  actionPlan: GeoAeoActionPlanWeek[];
  disclaimer: string;
}

interface GeoAeoActionPlanWeek {
  week: string;
  focus: string;
  tasks: GeoAeoActionPlanTask[];
}

interface GeoAeoActionPlanTask {
  task: string;
  why: string;
  owner: string;
  estimatedEffort: string;
  priority: number;
  expectedOutput: string;
}

export const GEO_AEO_REPORT_SUBTITLE =
  "GEO/AEO readiness report for ChatGPT, Gemini, Perplexity, and Google AI Overviews";

export const GEO_AEO_REPORT_DISCLAIMER =
  "AI-generated answers vary by model, location, prompt wording, date, personalization, available sources, and index freshness. This audit identifies practical improvements that may make the business easier for search engines and AI answer systems to understand, summarize, cite, and recommend. It does not guarantee rankings, traffic, leads, revenue, AI citations, or placement in Google AI Overviews, AI Mode, ChatGPT, Gemini, Perplexity, or any other system.";

export async function buildGeoAeoReportPayload(input: {
  audit: Audit;
  client: Client;
}): Promise<GeoAeoReportPayload> {
  const [profile, prompts, observations, pageAssessments, recommendations, scoreSnapshot, approvedIssues] =
    await Promise.all([
      db.query.geoAuditProfilesTable.findFirst({
        where: eq(geoAuditProfilesTable.auditId, input.audit.id),
        orderBy: desc(geoAuditProfilesTable.updatedAt),
      }),
      db.query.geoPromptsTable.findMany({ where: eq(geoPromptsTable.auditId, input.audit.id) }),
      db.query.geoVisibilityObservationsTable.findMany({
        where: eq(geoVisibilityObservationsTable.auditId, input.audit.id),
        orderBy: desc(geoVisibilityObservationsTable.observedAt),
      }),
      db.query.geoPageAssessmentsTable.findMany({ where: eq(geoPageAssessmentsTable.auditId, input.audit.id) }),
      db.query.geoRecommendationsTable.findMany({ where: eq(geoRecommendationsTable.auditId, input.audit.id) }),
      db.query.geoScoreSnapshotsTable.findFirst({
        where: eq(geoScoreSnapshotsTable.auditId, input.audit.id),
        orderBy: desc(geoScoreSnapshotsTable.createdAt),
      }),
      db.query.auditIssuesTable.findMany({ where: eq(auditIssuesTable.auditId, input.audit.id) }),
    ]);

  const promptById = new Map(prompts.map((prompt) => [prompt.id, prompt.promptText]));
  const score = normalizeScore(input.audit.aiVisibilityScore, scoreSnapshot);
  const visibleRecommendations = recommendations
    .filter((item) => item.status === "approved")
    .sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    title: "AI Visibility Audit",
    subtitle: GEO_AEO_REPORT_SUBTITLE,
    generatedAt: new Date(),
    client: {
      id: input.client.id,
      name: input.client.name,
      domain: input.client.domain,
    },
    audit: {
      id: input.audit.id,
      url: input.audit.url,
      auditType: input.audit.auditType,
      aiVisibilityScore: input.audit.aiVisibilityScore,
      completedAt: input.audit.completedAt,
      crawledPages: input.audit.crawledPages,
    },
    profile: profile ?? null,
    score,
    prompts: prompts.sort((a, b) => b.priority - a.priority),
    observations: observations
      .filter((item) => item.approved)
      .map((item) => ({
        ...item,
        promptText: item.promptId ? promptById.get(item.promptId) : null,
      })),
    pageAssessments: pageAssessments.sort((a, b) => a.pageUrl.localeCompare(b.pageUrl)),
    recommendations: visibleRecommendations,
    approvedIssues: approvedIssues.filter((issue) => issue.status === "approved"),
    actionPlan: buildActionPlan(visibleRecommendations),
    disclaimer: GEO_AEO_REPORT_DISCLAIMER,
  };
}

export function summarizeGeoAeoReport(payload: GeoAeoReportPayload): string {
  const risks = payload.score.topRisks.slice(0, 3);
  const quickWins = payload.score.quickWins.slice(0, 3);
  const riskCopy = risks.length ? risks.join("; ") : "No critical GEO/AEO blockers were identified from current evidence";
  const winCopy = quickWins.length ? quickWins.join("; ") : "Keep strengthening direct answers, proof signals, and schema coverage";

  return `This AI Visibility Audit gives ${payload.client.name} an overall score of ${payload.score.aiVisibilityScore}/100 (${payload.score.grade}). Top blockers: ${riskCopy}. Quick wins: ${winCopy}. Recommended next step: complete the Week 1 entity, crawlability, and profile fixes before expanding content and citation work.`;
}

export function renderGeoAeoMarkdownReport(payload: GeoAeoReportPayload): string {
  const lines: string[] = [
    `# ${md(payload.title)}`,
    "",
    md(payload.subtitle),
    "",
    `- Client/business name: ${md(payload.profile?.businessName ?? payload.client.name)}`,
    `- Website URL: ${md(payload.profile?.websiteUrl ?? payload.audit.url)}`,
    `- Audit date: ${formatDate(payload.audit.completedAt ?? payload.generatedAt)}`,
    "- Prepared by: SEORx",
    `- Package tier: ${md(payload.profile?.packageTier ?? "standard")}`,
    "",
    "## Executive Summary",
    "",
    `- Overall AI Visibility Score: ${payload.score.aiVisibilityScore}/100`,
    `- Plain-English grade: ${md(payload.score.grade)}`,
    bulletList("Top 3 blockers", payload.score.topRisks.slice(0, 3)),
    bulletList("Top 3 quick wins", payload.score.quickWins.slice(0, 3)),
    "- Recommended next step: Complete Week 1 entity, crawlability, and profile fixes, then add answer blocks, FAQ/schema, and sourceable proof.",
    "",
    "## What This Audit Measures",
    "",
    "- AI answer coverage",
    "- Entity clarity",
    "- AI-citable page structure",
    "- Proof and sourceability",
    "- Schema readiness",
    "- Crawlability/indexability",
    "- Competitor visibility gaps",
    "- Citation/source readiness",
    "",
    "## AI Visibility Score",
    "",
    "This score estimates how ready the website is to be understood, summarized, and cited by modern search and AI answer systems based on the pages, prompts, and evidence reviewed.",
    "",
    `- Overall score: ${payload.score.aiVisibilityScore}/100`,
    `- Grade: ${md(payload.score.grade)}`,
    "",
    "### Sub-scores",
    "",
    ...Object.entries(payload.score.subScores).map(([key, value]) => `- ${md(readableKey(key))}: ${value}/100`),
    "",
    bulletList("Top risks", payload.score.topRisks),
    bulletList("Quick wins", payload.score.quickWins),
    "",
    "## Prompt Set Generated/Tested",
    "",
    ...renderPrompts(payload.prompts),
    "",
    "## Baseline AI Visibility Observations",
    "",
    "These observations are snapshots. AI answers can vary by user, location, prompt wording, date, personalization, and source availability.",
    "",
    ...renderObservations(payload.observations),
    "",
    "## Competitor Comparison",
    "",
    ...renderCompetitorComparison(payload),
    "",
    "## Page-by-Page AI-Citability Review",
    "",
    ...renderPageAssessments(payload.pageAssessments),
    "",
    "## Top GEO/AEO Issues",
    "",
    ...renderRecommendations(payload.recommendations),
    "",
    "## FAQ and Schema Fixes",
    "",
    ...renderFaqAndSchema(payload),
    "",
    "## AI-Citable Service Page Recommendations",
    "",
    ...renderServicePageRecommendations(payload),
    "",
    "## Citation and Source Recommendations",
    "",
    ...renderCitationRecommendations(payload),
    "",
    "## 30-Day Action Plan",
    "",
    ...renderActionPlan(payload.actionPlan),
    "",
    "## Optional Next Steps / Upsell",
    "",
    "- Implementation package",
    "- AI-citable service page rewrite",
    "- FAQ/schema implementation",
    "- Monthly AI visibility monitoring",
    "- Hybrid SEO + GEO retainer",
    "",
    "Offer help implementing the plan. Do not promise results.",
    "",
    "## Disclaimer",
    "",
    md(payload.disclaimer),
    "",
  ];

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function normalizeScore(
  auditScore: number | null,
  snapshot: GeoScoreSnapshot | undefined,
): GeoAeoReportPayload["score"] {
  const score = Math.round(snapshot?.aiVisibilityScore ?? auditScore ?? 0);
  return {
    aiVisibilityScore: score,
    grade: snapshot?.grade ?? gradeForScore(score),
    subScores: asRecord(snapshot?.subScores),
    topRisks: asStringArray(snapshot?.topRisks),
    quickWins: asStringArray(snapshot?.quickWins),
  };
}

function buildActionPlan(recommendations: GeoRecommendation[]): GeoAeoActionPlanWeek[] {
  const priorityItems = recommendations.slice(0, 8);
  const fallbackOwner = "seo_specialist";

  return [
    {
      week: "Week 1",
      focus: "entity, crawlability, and profile fixes",
      tasks: [taskFromRecommendation(priorityItems[0], "Clarify entity, services, locations, and profile signals.", fallbackOwner)],
    },
    {
      week: "Week 2",
      focus: "answer blocks, FAQs, and page structure",
      tasks: [taskFromRecommendation(priorityItems[1], "Add direct answer blocks and FAQ coverage for buyer questions.", "content_writer")],
    },
    {
      week: "Week 3",
      focus: "schema, internal links, and service page improvements",
      tasks: [taskFromRecommendation(priorityItems[2], "Implement schema and strengthen service page context.", "developer")],
    },
    {
      week: "Week 4",
      focus: "source/citation signals, review proof, and re-check",
      tasks: [taskFromRecommendation(priorityItems[3], "Improve sourceable proof and re-check visibility observations.", fallbackOwner)],
    },
  ];
}

function taskFromRecommendation(
  recommendation: GeoRecommendation | undefined,
  fallbackTask: string,
  fallbackOwner: string,
): GeoAeoActionPlanTask {
  return {
    task: recommendation?.recommendation ?? fallbackTask,
    why: recommendation?.aiVisibilityImpact ?? recommendation?.businessImpact ?? "Improves AI readability, sourceability, and client-facing confidence.",
    owner: recommendation?.owner ?? fallbackOwner,
    estimatedEffort: recommendation?.estimatedEffort ?? "medium",
    priority: recommendation?.priorityScore ?? 70,
    expectedOutput: recommendation?.pageUrl
      ? `Updated page: ${recommendation.pageUrl}`
      : "Documented fix, implementation notes, and re-check evidence.",
  };
}

function renderPrompts(prompts: GeoPrompt[]): string[] {
  if (!prompts.length) return ["No prompt set has been generated for this audit yet."];
  return prompts.map((prompt) => [
    `### ${md(readableKey(prompt.intent))}`,
    "",
    `- Prompt text: ${md(prompt.promptText)}`,
    `- Intent: ${md(prompt.intent)}`,
    `- Target service/location: ${md([prompt.targetService, prompt.targetLocation].filter(Boolean).join(" / ") || "Not specified")}`,
    `- Priority: ${prompt.priority}/100`,
    `- Observation status: ${prompt.approved ? "approved/generated" : "generated only"}`,
  ].join("\n"));
}

function renderObservations(observations: GeoAeoReportPayload["observations"]): string[] {
  if (!observations.length) return ["No approved manual or provider-backed observations are available yet."];
  return observations.map((observation) => [
    `### ${md(readableKey(observation.surface))}`,
    "",
    `- Prompt: ${md(observation.promptText ?? "Manual observation")}`,
    `- Date observed: ${formatDate(observation.observedAt)}`,
    `- Brand mentioned: ${yesNo(observation.brandMentioned)}`,
    `- Brand cited: ${yesNo(observation.brandCited)}`,
    `- Competitors mentioned: ${md(asStringArray(observation.competitorsMentioned).join(", ") || "None recorded")}`,
    `- Cited/source URLs: ${md(asStringArray(observation.citedUrls).join(", ") || "None recorded")}`,
    `- Short answer summary: ${md(observation.answerSummary ?? "No summary recorded")}`,
    `- Confidence score: ${observation.confidenceScore}/100`,
  ].join("\n"));
}

function renderCompetitorComparison(payload: GeoAeoReportPayload): string[] {
  const competitors = asCompetitorNames(payload.profile?.competitors);
  const competitorIssues = payload.recommendations.filter((item) => item.category === "competitor_gap");
  if (!competitors.length && !competitorIssues.length) {
    return ["No competitor evidence was imported or observed. Competitor facts were not invented."];
  }
  return [
    `- Competitors reviewed from profile/manual evidence: ${md(competitors.join(", ") || "None listed")}`,
    `- Entity clarity gaps: ${countByCategory(payload.recommendations, "entity_clarity")}`,
    `- Service page specificity gaps: ${countByCategory(payload.recommendations, "service_location_gap")}`,
    `- FAQ coverage gaps: ${payload.recommendations.filter((item) => item.issueType.includes("FAQ")).length}`,
    `- Schema readiness gaps: ${payload.recommendations.filter((item) => item.issueType.includes("SCHEMA")).length}`,
    `- Proof signal gaps: ${countByCategory(payload.recommendations, "proof_trust")}`,
    `- External citation/source gaps: ${countByCategory(payload.recommendations, "citation_readiness")}`,
    `- Content depth gaps: ${countByCategory(payload.recommendations, "ai_answer_coverage")}`,
    `- Comparison/alternative content gaps: ${competitorIssues.length}`,
  ];
}

function renderPageAssessments(assessments: GeoPageAssessment[]): string[] {
  if (!assessments.length) return ["No page-level AI-citability assessments are available yet."];
  return assessments.map((assessment) => [
    `### ${md(assessment.pageUrl)}`,
    "",
    "- Page role: Assessed page",
    `- AI-citable score: ${assessment.aiCitableScore}/100`,
    `- Answer coverage score: ${assessment.answerCoverageScore}/100`,
    `- Entity clarity score: ${assessment.entityClarityScore}/100`,
    `- Proof signal score: ${assessment.proofSignalScore}/100`,
    `- Structure score: ${assessment.structureScore}/100`,
    `- Schema readiness score: ${assessment.schemaReadinessScore}/100`,
    `- Citation readiness score: ${assessment.citationReadinessScore}/100`,
    `- Top gaps: ${md(asStringArray(assessment.detectedGaps).join("; ") || "None recorded")}`,
    `- Recommended fixes: ${md(asStringArray(assessment.recommendedFixes).join("; ") || "None recorded")}`,
  ].join("\n"));
}

function renderRecommendations(recommendations: GeoRecommendation[]): string[] {
  if (!recommendations.length) return ["No GEO/AEO issues are available yet."];
  return recommendations.slice(0, 15).map((item) => [
    `### ${md(item.title)}`,
    "",
    `- Category: ${md(item.category)}`,
    `- Page URL: ${md(item.pageUrl ?? "Site-wide")}`,
    `- Evidence: ${md(item.evidence)}`,
    `- Why it matters for AI visibility: ${md(item.aiVisibilityImpact ?? "Improves the page's chance of being understood, summarized, and cited.")}`,
    `- Business impact: ${md(item.businessImpact ?? "Improves clarity for prospective customers and search/AI systems.")}`,
    `- Recommended fix: ${md(item.recommendation)}`,
    `- Priority: ${item.priorityScore}/100`,
    `- Estimated effort: ${md(item.estimatedEffort ?? "medium")}`,
    `- Recommended owner: ${md(item.owner ?? "seo_specialist")}`,
    `- Approval status: ${md(item.status)}`,
  ].join("\n"));
}

function renderFaqAndSchema(payload: GeoAeoReportPayload): string[] {
  const questions = asStringArray(payload.profile?.customerQuestions).slice(0, 10);
  const schemaIssues = payload.recommendations.filter((item) => item.issueType.includes("SCHEMA"));
  return [
    bulletList("Recommended FAQ questions", questions.length ? questions : ["What services do you offer?", "Where do you serve customers?", "Why should customers trust this business?"]),
    "- Suggested direct answer blocks: Add concise, evidence-backed answers near the top of relevant service and FAQ pages.",
    "- Recommended schema types: Organization, LocalBusiness, Service, FAQPage, BreadcrumbList, Article, and sameAs links where evidence-backed.",
    `- Missing schema fields: ${md(schemaIssues.map((item) => item.title).join("; ") || "Use scanner findings to confirm missing fields before implementation.")}`,
    "- Implementation notes: Keep schema aligned with visible page copy and avoid unsupported review or claim markup.",
  ];
}

function renderServicePageRecommendations(payload: GeoAeoReportPayload): string[] {
  const serviceRecommendations = payload.recommendations
    .filter((item) => item.category === "service_location_gap" || item.issueType.includes("SERVICE"))
    .slice(0, 5);

  if (!serviceRecommendations.length) {
    return ["No dedicated service page opportunities were identified from current evidence."];
  }

  return serviceRecommendations.map((item) => [
    `### ${md(item.pageUrl ?? "Recommended service page")}`,
    "",
    `- Recommended URL: ${md(item.pageUrl ?? "Create or strengthen the relevant service/location URL.")}`,
    `- Recommended H1: ${md(item.title)}`,
    `- Direct answer block: ${md(item.recommendation)}`,
    "- Suggested H2 outline: Service overview, who it helps, locations served, proof, FAQ, next step.",
    "- Proof blocks to add: reviews, case studies, credentials, process proof, before/after evidence where available.",
    "- FAQs to add: common buyer questions from the profile and prompt set.",
    "- Schema to add: Service, LocalBusiness or Organization, FAQPage, BreadcrumbList.",
    "- Internal links to add: homepage, related services, location pages, contact/booking page.",
    "- CTA to add: clear next step matching the service page intent.",
  ].join("\n"));
}

function renderCitationRecommendations(payload: GeoAeoReportPayload): string[] {
  const proofPoints = asStringArray(payload.profile?.proofPoints);
  return [
    "- Google Business Profile improvements",
    "- Industry directories",
    "- Local chamber/business associations",
    "- Review platforms",
    "- Professional profiles",
    "- Partner/vendor pages",
    "- Case studies",
    `- Testimonials/proof points: ${md(proofPoints.join("; ") || "Add evidence-backed testimonials and proof blocks before citing them externally.")}`,
    "- Author bios",
    "- Press or local media opportunities",
    "- sameAs profile links",
    "",
    "Do not use paid link schemes or spammy citation manipulation.",
  ];
}

function renderActionPlan(plan: GeoAeoActionPlanWeek[]): string[] {
  return plan.flatMap((week) => [
    `### ${week.week}: ${md(week.focus)}`,
    "",
    ...week.tasks.map((task) => [
      `- Task: ${md(task.task)}`,
      `- Why it matters: ${md(task.why)}`,
      `- Owner: ${md(task.owner)}`,
      `- Estimated effort: ${md(task.estimatedEffort)}`,
      `- Priority: ${task.priority}/100`,
      `- Expected output: ${md(task.expectedOutput)}`,
    ].join("\n")),
    "",
  ]);
}

function bulletList(label: string, values: string[]): string {
  const items = values.length ? values : ["No items recorded yet."];
  return [`- ${label}:`, ...items.map((item) => `  - ${md(item)}`)].join("\n");
}

function countByCategory(recommendations: GeoRecommendation[], category: string): number {
  return recommendations.filter((item) => item.category === category).length;
}

function asRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => typeof item === "number" && Number.isFinite(item)),
  ) as Record<string, number>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function asCompetitorNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "name" in item && typeof item.name === "string") return item.name;
      if (item && typeof item === "object" && "url" in item && typeof item.url === "string") return item.url;
      return null;
    })
    .filter((item): item is string => Boolean(item));
}

function formatDate(value: Date | string | null): string {
  if (!value) return "Not completed";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Not completed";
  return date.toISOString().slice(0, 10);
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

function readableKey(key: string): string {
  return key.replace(/_/g, " ").replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`).trim();
}

function md(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/[<>]/g, (match) => (match === "<" ? "&lt;" : "&gt;"))
    .trim();
}
