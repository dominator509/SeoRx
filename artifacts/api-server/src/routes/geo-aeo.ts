import { Router } from "express";
import {
  auditIssuesTable,
  auditsTable,
  clientsTable,
  db,
  geoAuditProfilesTable,
  geoPageAssessmentsTable,
  geoPromptsTable,
  geoRecommendationsTable,
  geoScoreSnapshotsTable,
  geoVisibilityObservationsTable,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { ZodError } from "zod";
import { assertAuditAccess, requireAuth } from "../lib/rbac";
import { generateAiText, getActiveProvider } from "../lib/ai-adapter";
import {
  calculateGeoAeoScore,
  generateGeoAeoDraftRecommendations,
  generateGeoPromptSet,
  GeoAeoAiDraftError,
  geoAuditProfileInputSchema,
  geoRecommendationInputSchema,
  normalizeGeoObservation,
} from "../lib/geo-aeo";

const router = Router();

const issueCategories = new Set([
  "meta",
  "content",
  "performance",
  "links",
  "structured_data",
  "mobile",
  "security",
  "crawlability",
  "ai_answer_coverage",
  "entity_clarity",
  "ai_citable_structure",
  "proof_trust",
  "competitor_gap",
  "service_location_gap",
  "citation_readiness",
]);

const geoRecommendationUpdateSchema = geoRecommendationInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one recommendation field is required",
);

router.use("/audits/:id/geo", requireAuth, async (req, res, next) => {
  if (process.env.GEO_AEO_ENABLED !== "true") {
    res.status(404).json({ error: "GEO/AEO is disabled" });
    return;
  }

  const audit = await assertAuditAccess(req, req.params.id as string);
  if (!audit) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.locals.audit = audit;
  next();
});

router.get("/audits/:id/geo/overview", async (req, res) => {
  try {
    const auditId = req.params.id as string;
    const [profile, prompts, observations, pageAssessments, recommendations, latestScore] = await Promise.all([
      latestProfile(auditId),
      db.select().from(geoPromptsTable).where(eq(geoPromptsTable.auditId, auditId)).orderBy(desc(geoPromptsTable.priority)),
      db.select().from(geoVisibilityObservationsTable).where(eq(geoVisibilityObservationsTable.auditId, auditId)).orderBy(desc(geoVisibilityObservationsTable.observedAt)),
      db.select().from(geoPageAssessmentsTable).where(eq(geoPageAssessmentsTable.auditId, auditId)),
      db.select().from(geoRecommendationsTable).where(eq(geoRecommendationsTable.auditId, auditId)).orderBy(desc(geoRecommendationsTable.priorityScore)),
      latestScoreSnapshot(auditId),
    ]);

    res.json({
      profile: profile ?? null,
      prompts,
      observations,
      pageAssessments,
      recommendations,
      latestScore: latestScore ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get GEO/AEO overview");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/audits/:id/geo/profile", async (req, res) => {
  try {
    const auditId = req.params.id as string;
    const profile = geoAuditProfileInputSchema.parse(req.body);
    const id = crypto.randomUUID();

    await db.insert(geoAuditProfilesTable).values({
      id,
      auditId,
      businessName: profile.businessName,
      websiteUrl: profile.websiteUrl,
      primaryOffer: profile.primaryOffer ?? null,
      targetLocations: profile.targetLocations,
      targetServices: profile.targetServices,
      targetCustomers: profile.targetCustomers,
      competitors: profile.competitors,
      proofPoints: profile.proofPoints,
      reviewsUrl: emptyToNull(profile.reviewsUrl),
      googleBusinessUrl: emptyToNull(profile.googleBusinessUrl),
      importantPages: profile.importantPages,
      customerQuestions: profile.customerQuestions,
      knownFor: profile.knownFor ?? null,
      packageTier: profile.packageTier,
    });

    const saved = await db.query.geoAuditProfilesTable.findFirst({ where: eq(geoAuditProfilesTable.id, id) });
    res.status(201).json(saved);
  } catch (err) {
    handleRouteError(req, res, err, "Failed to save GEO/AEO profile");
  }
});

router.post("/audits/:id/geo/prompts/generate", async (req, res) => {
  try {
    const auditId = req.params.id as string;
    const profile = geoAuditProfileInputSchema.parse(req.body.profile ?? await latestProfilePayload(auditId));
    const prompts = generateGeoPromptSet({ profile, maxPrompts: Number(req.body.maxPrompts) || undefined });
    const rows = prompts.map((prompt) => ({
      id: crypto.randomUUID(),
      auditId,
      promptText: prompt.promptText,
      intent: prompt.intent,
      targetService: prompt.targetService ?? null,
      targetLocation: prompt.targetLocation ?? null,
      buyerStage: prompt.buyerStage,
      priority: prompt.priority,
      approved: false,
    }));

    if (rows.length) {
      await db.insert(geoPromptsTable).values(rows);
    }

    res.status(201).json({ items: rows, total: rows.length });
  } catch (err) {
    handleRouteError(req, res, err, "Failed to generate GEO/AEO prompts");
  }
});

router.get("/audits/:id/geo/prompts", async (req, res) => {
  try {
    const auditId = req.params.id as string;
    const prompts = await db
      .select()
      .from(geoPromptsTable)
      .where(eq(geoPromptsTable.auditId, auditId))
      .orderBy(desc(geoPromptsTable.priority));
    res.json(prompts);
  } catch (err) {
    req.log.error({ err }, "Failed to list GEO/AEO prompts");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/audits/:id/geo/observations", async (req, res) => {
  try {
    const auditId = req.params.id as string;
    const observation = normalizeGeoObservation(req.body);

    if (observation.promptId) {
      const prompt = await db.query.geoPromptsTable.findFirst({
        where: and(eq(geoPromptsTable.id, observation.promptId), eq(geoPromptsTable.auditId, auditId)),
      });
      if (!prompt) {
        res.status(400).json({ error: "Prompt does not belong to this audit" });
        return;
      }
    }

    const id = crypto.randomUUID();
    await db.insert(geoVisibilityObservationsTable).values({
      id,
      auditId,
      promptId: observation.promptId ?? null,
      surface: observation.surface,
      observedAt: observation.observedAt ? new Date(observation.observedAt) : new Date(),
      brandMentioned: observation.brandMentioned,
      brandCited: observation.brandCited,
      brandPosition: observation.brandPosition ?? null,
      sentiment: observation.sentiment,
      answerSummary: observation.answerSummary ?? null,
      citedUrls: observation.citedUrls,
      competitorsMentioned: observation.competitorsMentioned,
      rawAnswerExcerpt: observation.rawAnswerExcerpt ?? null,
      confidenceScore: observation.confidenceScore,
      observationMode: "manual",
      notes: observation.notes ?? null,
      approved: false,
    });

    const saved = await db.query.geoVisibilityObservationsTable.findFirst({ where: eq(geoVisibilityObservationsTable.id, id) });
    res.status(201).json(saved);
  } catch (err) {
    handleRouteError(req, res, err, "Failed to create GEO/AEO observation");
  }
});

router.post("/audits/:id/geo/recommendations", async (req, res) => {
  try {
    const auditId = req.params.id as string;
    const recommendation = geoRecommendationInputSchema.parse(req.body);
    const id = crypto.randomUUID();

    await db.insert(geoRecommendationsTable).values({
      id,
      auditId,
      pageUrl: recommendation.pageUrl ?? null,
      category: normalizeIssueCategory(recommendation.category),
      issueType: recommendation.issueType,
      title: recommendation.title,
      evidence: recommendation.evidence,
      recommendation: recommendation.recommendation,
      aiVisibilityImpact: recommendation.aiVisibilityImpact ?? null,
      businessImpact: recommendation.businessImpact ?? null,
      priorityScore: recommendation.priorityScore,
      estimatedEffort: recommendation.estimatedEffort ?? null,
      owner: recommendation.owner ?? null,
      fiverrPackageTier: recommendation.fiverrPackageTier ?? null,
      status: recommendation.status,
    });

    const saved = await db.query.geoRecommendationsTable.findFirst({ where: eq(geoRecommendationsTable.id, id) });
    res.status(201).json(saved);
  } catch (err) {
    handleRouteError(req, res, err, "Failed to create GEO/AEO recommendation");
  }
});

router.post("/audits/:id/geo/recommendations/draft", async (req, res) => {
  try {
    const auditId = req.params.id as string;
    const audit = res.locals.audit as typeof auditsTable.$inferSelect;
    const [client, profile, prompts, observations, pageAssessments, recommendations, latestScore] = await Promise.all([
      db.query.clientsTable.findFirst({ where: eq(clientsTable.id, audit.clientId) }),
      latestProfile(auditId),
      db.select().from(geoPromptsTable).where(eq(geoPromptsTable.auditId, auditId)).orderBy(desc(geoPromptsTable.priority)),
      db.select().from(geoVisibilityObservationsTable).where(eq(geoVisibilityObservationsTable.auditId, auditId)).orderBy(desc(geoVisibilityObservationsTable.observedAt)),
      db.select().from(geoPageAssessmentsTable).where(eq(geoPageAssessmentsTable.auditId, auditId)),
      db.select().from(geoRecommendationsTable).where(eq(geoRecommendationsTable.auditId, auditId)).orderBy(desc(geoRecommendationsTable.priorityScore)),
      latestScoreSnapshot(auditId),
    ]);

    const provider = await getActiveProvider(client?.orgId ?? undefined);
    const draft = await generateGeoAeoDraftRecommendations({
      context: {
        auditUrl: audit.url,
        profile: profile ?? null,
        prompts,
        observations,
        pageAssessments,
        recommendations,
        score: latestScore ?? null,
      },
      provider,
      generateText: provider
        ? ({ provider: activeProvider, systemPrompt, prompt }) => generateAiText(activeProvider, prompt, systemPrompt)
        : undefined,
    });

    const rows = draft.recommendations.map((recommendation) => ({
      id: crypto.randomUUID(),
      auditId,
      pageUrl: recommendation.pageUrl ?? null,
      category: normalizeIssueCategory(recommendation.category),
      issueType: recommendation.issueType,
      title: recommendation.title,
      evidence: recommendation.evidence,
      recommendation: recommendation.recommendation,
      aiVisibilityImpact: recommendation.aiVisibilityImpact ?? null,
      businessImpact: recommendation.businessImpact ?? null,
      priorityScore: recommendation.priorityScore,
      estimatedEffort: recommendation.estimatedEffort ?? null,
      owner: recommendation.owner ?? null,
      fiverrPackageTier: recommendation.fiverrPackageTier ?? null,
      status: "draft",
    }));

    if (rows.length) {
      await db.insert(geoRecommendationsTable).values(rows);
    }

    res.status(201).json({
      mode: draft.mode,
      providerUsed: draft.providerUsed,
      items: rows,
      total: rows.length,
    });
  } catch (err) {
    if (err instanceof GeoAeoAiDraftError) {
      res.status(err.message.includes("requires") ? 400 : 502).json({ error: err.message });
      return;
    }
    handleRouteError(req, res, err, "Failed to generate GEO/AEO recommendation drafts");
  }
});

router.patch("/audits/:id/geo/recommendations/:recommendationId", async (req, res) => {
  try {
    const auditId = req.params.id as string;
    const recommendationId = req.params.recommendationId as string;
    const existing = await db.query.geoRecommendationsTable.findFirst({
      where: and(eq(geoRecommendationsTable.id, recommendationId), eq(geoRecommendationsTable.auditId, auditId)),
    });
    if (!existing) {
      res.status(404).json({ error: "Recommendation not found" });
      return;
    }

    const patch = geoRecommendationUpdateSchema.parse(req.body);
    await db.update(geoRecommendationsTable)
      .set({
        ...(patch.pageUrl !== undefined ? { pageUrl: emptyToNull(patch.pageUrl) } : {}),
        ...(patch.category !== undefined ? { category: normalizeIssueCategory(patch.category) } : {}),
        ...(patch.issueType !== undefined ? { issueType: patch.issueType } : {}),
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.evidence !== undefined ? { evidence: patch.evidence } : {}),
        ...(patch.recommendation !== undefined ? { recommendation: patch.recommendation } : {}),
        ...(patch.aiVisibilityImpact !== undefined ? { aiVisibilityImpact: emptyToNull(patch.aiVisibilityImpact) } : {}),
        ...(patch.businessImpact !== undefined ? { businessImpact: emptyToNull(patch.businessImpact) } : {}),
        ...(patch.priorityScore !== undefined ? { priorityScore: patch.priorityScore } : {}),
        ...(patch.estimatedEffort !== undefined ? { estimatedEffort: patch.estimatedEffort ?? null } : {}),
        ...(patch.owner !== undefined ? { owner: patch.owner ?? null } : {}),
        ...(patch.fiverrPackageTier !== undefined ? { fiverrPackageTier: patch.fiverrPackageTier ?? null } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(geoRecommendationsTable.id, recommendationId));

    const saved = await db.query.geoRecommendationsTable.findFirst({ where: eq(geoRecommendationsTable.id, recommendationId) });
    res.json(saved);
  } catch (err) {
    handleRouteError(req, res, err, "Failed to update GEO/AEO recommendation");
  }
});

router.post("/audits/:id/geo/recommendations/:recommendationId/approve", async (req, res) => {
  const clerkId = (req as any).clerkUserId as string;
  try {
    const auditId = req.params.id as string;
    const recommendationId = req.params.recommendationId as string;
    const recommendation = await db.query.geoRecommendationsTable.findFirst({
      where: and(eq(geoRecommendationsTable.id, recommendationId), eq(geoRecommendationsTable.auditId, auditId)),
    });
    if (!recommendation) {
      res.status(404).json({ error: "Recommendation not found" });
      return;
    }

    await db.update(geoRecommendationsTable)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(geoRecommendationsTable.id, recommendationId));

    const issueId = crypto.randomUUID();
    await db.insert(auditIssuesTable).values({
      id: issueId,
      auditId,
      url: recommendation.pageUrl ?? (res.locals.audit?.url as string),
      category: normalizeIssueCategory(recommendation.category) as any,
      issueType: recommendation.issueType,
      severity: severityForPriority(recommendation.priorityScore),
      title: recommendation.title,
      description: recommendation.evidence,
      evidence: { source: "geo_recommendation", recommendationId },
      recommendation: recommendation.recommendation,
      aiVisibilityImpact: recommendation.aiVisibilityImpact,
      businessImpact: recommendation.businessImpact,
      estimatedEffort: recommendation.estimatedEffort,
      recommendedOwner: recommendation.owner,
      priorityScore: recommendation.priorityScore,
      status: "approved",
      approvedBy: clerkId,
      approvedAt: new Date(),
    });

    const issue = await db.query.auditIssuesTable.findFirst({ where: eq(auditIssuesTable.id, issueId) });
    res.status(201).json({ recommendationId, issue });
  } catch (err) {
    req.log.error({ err }, "Failed to approve GEO/AEO recommendation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/audits/:id/geo/score", async (req, res) => {
  try {
    const auditId = req.params.id as string;
    const [profileRow, pageAssessments, recommendations, observations] = await Promise.all([
      latestProfile(auditId),
      db.select().from(geoPageAssessmentsTable).where(eq(geoPageAssessmentsTable.auditId, auditId)),
      db.select().from(geoRecommendationsTable).where(eq(geoRecommendationsTable.auditId, auditId)),
      db.select().from(geoVisibilityObservationsTable).where(eq(geoVisibilityObservationsTable.auditId, auditId)),
    ]);

    const profile = profileRow ? profileRowToPayload(profileRow) : undefined;
    const score = calculateGeoAeoScore({
      profile,
      pageAssessments: pageAssessments.map((assessment) => ({
        aiCitableScore: assessment.aiCitableScore,
        answerCoverageScore: assessment.answerCoverageScore,
        entityClarityScore: assessment.entityClarityScore,
        proofSignalScore: assessment.proofSignalScore,
        structureScore: assessment.structureScore,
        schemaReadinessScore: assessment.schemaReadinessScore,
        citationReadinessScore: assessment.citationReadinessScore,
      })),
      recommendations: recommendations.map((recommendation) => ({
        issueType: recommendation.issueType as any,
        priorityScore: recommendation.priorityScore,
        title: recommendation.title,
      })),
      observations: observations.map((observation) => ({
        brandMentioned: observation.brandMentioned,
        brandCited: observation.brandCited,
        competitorsMentioned: arrayFromJson(observation.competitorsMentioned),
      })),
    });

    const id = crypto.randomUUID();
    await db.insert(geoScoreSnapshotsTable).values({
      id,
      auditId,
      aiVisibilityScore: score.aiVisibilityScore,
      grade: score.grade,
      subScores: score.subScores,
      topRisks: score.topRisks,
      quickWins: score.quickWins,
    });
    await db.update(auditsTable)
      .set({ aiVisibilityScore: score.aiVisibilityScore, updatedAt: new Date() })
      .where(eq(auditsTable.id, auditId));

    const snapshot = await db.query.geoScoreSnapshotsTable.findFirst({ where: eq(geoScoreSnapshotsTable.id, id) });
    res.status(201).json(snapshot);
  } catch (err) {
    req.log.error({ err }, "Failed to score GEO/AEO audit");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function latestProfile(auditId: string) {
  return db.query.geoAuditProfilesTable.findFirst({
    where: eq(geoAuditProfilesTable.auditId, auditId),
    orderBy: desc(geoAuditProfilesTable.createdAt),
  });
}

async function latestScoreSnapshot(auditId: string) {
  return db.query.geoScoreSnapshotsTable.findFirst({
    where: eq(geoScoreSnapshotsTable.auditId, auditId),
    orderBy: desc(geoScoreSnapshotsTable.createdAt),
  });
}

async function latestProfilePayload(auditId: string) {
  const profile = await latestProfile(auditId);
  if (!profile) throw new ZodError([]);
  return profileRowToPayload(profile);
}

function profileRowToPayload(profile: NonNullable<Awaited<ReturnType<typeof latestProfile>>>) {
  return geoAuditProfileInputSchema.parse({
    businessName: profile.businessName,
    websiteUrl: profile.websiteUrl,
    primaryOffer: profile.primaryOffer ?? undefined,
    targetLocations: arrayFromJson(profile.targetLocations),
    targetServices: arrayFromJson(profile.targetServices),
    targetCustomers: arrayFromJson(profile.targetCustomers),
    competitors: arrayFromJson(profile.competitors),
    proofPoints: arrayFromJson(profile.proofPoints),
    reviewsUrl: profile.reviewsUrl ?? undefined,
    googleBusinessUrl: profile.googleBusinessUrl ?? undefined,
    importantPages: arrayFromJson(profile.importantPages),
    customerQuestions: arrayFromJson(profile.customerQuestions),
    knownFor: profile.knownFor ?? undefined,
    packageTier: profile.packageTier,
  });
}

function arrayFromJson(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function emptyToNull(value: string | undefined): string | null {
  return value?.trim() ? value : null;
}

function normalizeIssueCategory(category: string): string {
  return issueCategories.has(category) ? category : "ai_answer_coverage";
}

function severityForPriority(priorityScore: number): "critical" | "high" | "medium" | "low" | "info" {
  if (priorityScore >= 90) return "critical";
  if (priorityScore >= 75) return "high";
  if (priorityScore >= 50) return "medium";
  if (priorityScore >= 25) return "low";
  return "info";
}

function handleRouteError(req: any, res: any, err: unknown, message: string) {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Invalid GEO/AEO payload", details: err.issues });
    return;
  }
  req.log.error({ err }, message);
  res.status(500).json({ error: "Internal server error" });
}

export default router;
