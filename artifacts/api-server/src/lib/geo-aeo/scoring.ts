import type { GeoAuditProfileInput, GeoRecommendationInput, GeoVisibilityObservationInput } from "./schemas";

export interface GeoPageAssessmentInput {
  aiCitableScore: number;
  answerCoverageScore: number;
  entityClarityScore: number;
  proofSignalScore: number;
  structureScore: number;
  schemaReadinessScore: number;
  citationReadinessScore: number;
  crawlabilityScore?: number;
}

export interface GeoScorePayload {
  aiVisibilityScore: number;
  grade: "Excellent" | "Strong" | "Needs Work" | "Weak" | "Critical";
  subScores: {
    answerCoverage: number;
    entityClarity: number;
    aiCitableStructure: number;
    proofAndSourceability: number;
    schemaReadiness: number;
    crawlabilityIndexability: number;
    competitorGap: number;
    localOrCommerceCompleteness: number;
  };
  topRisks: string[];
  quickWins: string[];
}

export function calculateGeoAeoScore(input: {
  profile?: Partial<GeoAuditProfileInput>;
  pageAssessments: GeoPageAssessmentInput[];
  recommendations?: Pick<GeoRecommendationInput, "issueType" | "priorityScore" | "title">[];
  observations?: Pick<GeoVisibilityObservationInput, "brandMentioned" | "brandCited" | "competitorsMentioned">[];
}): GeoScorePayload {
  const assessments = input.pageAssessments;
  const recommendations = input.recommendations ?? [];
  const observations = input.observations ?? [];

  const subScores = {
    answerCoverage: average(assessments.map((item) => item.answerCoverageScore), 45),
    entityClarity: average(assessments.map((item) => item.entityClarityScore), 45),
    aiCitableStructure: average(
      assessments.map((item) => Math.round((item.aiCitableScore + item.structureScore) / 2)),
      45,
    ),
    proofAndSourceability: average(
      assessments.map((item) => Math.round((item.proofSignalScore + item.citationReadinessScore) / 2)),
      40,
    ),
    schemaReadiness: average(assessments.map((item) => item.schemaReadinessScore), 40),
    crawlabilityIndexability: average(assessments.map((item) => item.crawlabilityScore ?? 80), 80),
    competitorGap: competitorGapScore(observations, recommendations),
    localOrCommerceCompleteness: profileCompletenessScore(input.profile),
  };

  const aiVisibilityScore = clampScore(Math.round(
    subScores.answerCoverage * 0.2 +
    subScores.entityClarity * 0.15 +
    subScores.aiCitableStructure * 0.15 +
    subScores.proofAndSourceability * 0.15 +
    subScores.schemaReadiness * 0.1 +
    subScores.crawlabilityIndexability * 0.1 +
    subScores.competitorGap * 0.1 +
    subScores.localOrCommerceCompleteness * 0.05,
  ));

  return {
    aiVisibilityScore,
    grade: gradeForScore(aiVisibilityScore),
    subScores,
    topRisks: topRisks(subScores, recommendations),
    quickWins: quickWins(subScores),
  };
}

export function gradeForScore(score: number): GeoScorePayload["grade"] {
  const bounded = clampScore(score);
  if (bounded >= 90) return "Excellent";
  if (bounded >= 75) return "Strong";
  if (bounded >= 60) return "Needs Work";
  if (bounded >= 40) return "Weak";
  return "Critical";
}

function competitorGapScore(
  observations: Pick<GeoVisibilityObservationInput, "brandMentioned" | "brandCited" | "competitorsMentioned">[],
  recommendations: Pick<GeoRecommendationInput, "issueType" | "priorityScore" | "title">[],
): number {
  const competitorIssuePenalty = recommendations
    .filter((item) => item.issueType === "COMPETITOR_OWNS_AI_PROMPT")
    .reduce((sum, item) => sum + Math.min(item.priorityScore, 100), 0);

  if (!observations.length) return clampScore(70 - Math.round(competitorIssuePenalty / 10));

  const brandMentionRate = observations.filter((item) => item.brandMentioned).length / observations.length;
  const brandCitationRate = observations.filter((item) => item.brandCited).length / observations.length;
  const competitorMentions = observations.reduce(
    (sum, item) => sum + (item.competitorsMentioned?.length ?? 0),
    0,
  );

  return clampScore(Math.round(
    brandMentionRate * 45 +
    brandCitationRate * 35 +
    Math.max(0, 20 - competitorMentions * 4) -
    competitorIssuePenalty / 20,
  ));
}

function profileCompletenessScore(profile: Partial<GeoAuditProfileInput> | undefined): number {
  if (!profile) return 35;
  const checks = [
    Boolean(profile.businessName),
    Boolean(profile.websiteUrl),
    Boolean(profile.primaryOffer || profile.targetServices?.length),
    Boolean(profile.targetLocations?.length || profile.targetCustomers?.length),
    Boolean(profile.competitors?.length),
    Boolean(profile.proofPoints?.length || profile.reviewsUrl || profile.googleBusinessUrl),
  ];
  return clampScore(Math.round((checks.filter(Boolean).length / checks.length) * 100));
}

function topRisks(
  subScores: GeoScorePayload["subScores"],
  recommendations: Pick<GeoRecommendationInput, "issueType" | "priorityScore" | "title">[],
): string[] {
  const risks = Object.entries(subScores)
    .filter(([, score]) => score < 60)
    .sort((a, b) => a[1] - b[1])
    .map(([key]) => readableScoreKey(key));

  const priorityRisks = recommendations
    .filter((item) => item.priorityScore >= 80)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map((item) => item.title);

  return [...priorityRisks, ...risks].slice(0, 5);
}

function quickWins(subScores: GeoScorePayload["subScores"]): string[] {
  const wins: string[] = [];
  if (subScores.entityClarity < 75) wins.push("Clarify business entity, services, and locations on key pages.");
  if (subScores.answerCoverage < 75) wins.push("Add direct answer blocks for buyer questions.");
  if (subScores.schemaReadiness < 75) wins.push("Add Organization, Service, LocalBusiness, FAQ, or Breadcrumb schema where relevant.");
  if (subScores.proofAndSourceability < 75) wins.push("Add proof points, reviews, case studies, and sourceable claims.");
  return wins.slice(0, 5);
}

function average(values: number[], fallback: number): number {
  const bounded = values.map(clampScore).filter((value) => Number.isFinite(value));
  if (!bounded.length) return fallback;
  return clampScore(Math.round(bounded.reduce((sum, value) => sum + value, 0) / bounded.length));
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function readableScoreKey(key: string): string {
  return key.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`);
}
