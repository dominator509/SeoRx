import { Router } from "express";
import {
  db,
  auditsTable,
  auditIssuesTable,
  clientsTable,
  geoPageAssessmentsTable,
  geoRecommendationsTable,
  geoScoreSnapshotsTable,
  pageSpeedResultsTable,
} from "@workspace/db";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { requireAuth, assertClientAccess, assertAuditAccess, getAllowedClientIds } from "../lib/rbac";
import { enforceAuditLimit, enforceAiLimit } from "../lib/plan-enforcement";
import { crawlSite } from "../lib/crawler";
import { analyzeCrawlResult } from "../lib/seo-analyzer";
import { getActiveProvider, generateBatchRecommendations } from "../lib/ai-adapter";
import { logger } from "../lib/logger";
import { fetchRealPageSpeed, syntheticPageSpeed, type PageSpeedMetrics } from "../lib/pagespeed";
import { calculateGeoAeoScore, runGeoAeoScanners } from "../lib/geo-aeo";

const router = Router();

router.get("/audits", requireAuth, async (req, res) => {
  try {
    const { clientId, status, limit = "20", offset = "0" } = req.query as {
      clientId?: string; status?: string; limit?: string; offset?: string;
    };

    const conditions: any[] = [];
    const allowedClientIds = await getAllowedClientIds(req);
    if (clientId) {
      if (!allowedClientIds.includes(clientId) && req.seorxUser?.role !== "superadmin") {
        res.json({ items: [], total: 0, limit: Number(limit), offset: Number(offset) });
        return;
      }
      conditions.push(eq(auditsTable.clientId, clientId));
    } else if (allowedClientIds.length > 0) {
      conditions.push(inArray(auditsTable.clientId, allowedClientIds));
    } else if (req.seorxUser?.role !== "superadmin") {
      res.json({ items: [], total: 0, limit: Number(limit), offset: Number(offset) });
      return;
    }
    if (status) conditions.push(eq(auditsTable.status as any, status));

    const audits = await db.select().from(auditsTable).where(and(...conditions)).orderBy(desc(auditsTable.createdAt)).limit(Number(limit)).offset(Number(offset));
    const total = await db.$count(auditsTable, and(...conditions));

    const enriched = await Promise.all(
      audits.map(async (audit) => {
        const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, audit.clientId) });
        const issueCounts = await db
          .select({ severity: auditIssuesTable.severity, cnt: sql<number>`count(*)::int` })
          .from(auditIssuesTable)
          .where(eq(auditIssuesTable.auditId, audit.id))
          .groupBy(auditIssuesTable.severity);

        const counts = { criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, issueCount: 0 };
        for (const ic of issueCounts) {
          counts.issueCount += ic.cnt;
          if (ic.severity === "critical") counts.criticalCount = ic.cnt;
          else if (ic.severity === "high") counts.highCount = ic.cnt;
          else if (ic.severity === "medium") counts.mediumCount = ic.cnt;
          else if (ic.severity === "low") counts.lowCount = ic.cnt;
        }
        return { ...audit, clientName: client?.name ?? "", ...counts };
      }),
    );

    res.json({ items: enriched, total, limit: Number(limit), offset: Number(offset) });
  } catch (err) {
    req.log.error({ err }, "Failed to list audits");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/audits", requireAuth, enforceAuditLimit(), enforceAiLimit(), async (req, res) => {
  try {
    const { clientId, url, maxPages = 50, includePageSpeed = false, aiProviderId, auditType = "seo" } = req.body;

    // RBAC: user must have access to the client
    const client = await assertClientAccess(req, clientId as string);
    if (!client) { res.status(403).json({ error: "Access denied or client not found" }); return; }

    // Validate URL
    let normalizedUrl: string;
    try {
      const u = new URL((url as string).startsWith("http") ? url : `https://${url}`);
      normalizedUrl = u.href;
    } catch {
      res.status(400).json({ error: "Invalid URL" });
      return;
    }

    if (!["seo", "geo_aeo", "hybrid"].includes(auditType as string)) {
      res.status(400).json({ error: "Invalid audit type" });
      return;
    }

    const id = crypto.randomUUID();
    await db.insert(auditsTable).values({
      id,
      clientId,
      url: normalizedUrl,
      auditType,
      maxPages,
      includePageSpeed,
      aiProviderId: aiProviderId || null,
      status: "pending",
    });

    runRealAudit({
      auditId: id,
      clientId: clientId as string,
      clientName: client.name,
      orgId: client.orgId,
      url: normalizedUrl,
      maxPages: maxPages as number,
      includePageSpeed: includePageSpeed as boolean,
      auditType: auditType as "seo" | "geo_aeo" | "hybrid",
    }).catch((err) => {
      logger.error({ err, auditId: id }, "Real audit failed");
    });

    const audit = await db.query.auditsTable.findFirst({ where: eq(auditsTable.id, id) });
    res.status(201).json({ ...audit, clientName: client.name, issueCount: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to create audit");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/audits/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const audit = await assertAuditAccess(req, id);
    if (!audit) { res.status(404).json({ error: "Not found or access denied" }); return; }

    const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, audit.clientId) });
    const issues = await db.query.auditIssuesTable.findMany({ where: eq(auditIssuesTable.auditId, audit.id) });
    const issueCounts = { criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, issueCount: issues.length };
    for (const i of issues) {
      if (i.severity === "critical") issueCounts.criticalCount++;
      else if (i.severity === "high") issueCounts.highCount++;
      else if (i.severity === "medium") issueCounts.mediumCount++;
      else if (i.severity === "low") issueCounts.lowCount++;
    }
    res.json({ ...audit, clientName: client?.name ?? "", ...issueCounts, issues });
  } catch (err) {
    req.log.error({ err }, "Failed to get audit");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/audits/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const audit = await assertAuditAccess(req, id);
    if (!audit) { res.status(403).json({ error: "Access denied" }); return; }
    await db.delete(auditsTable).where(eq(auditsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete audit");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/audits/:id/issues", requireAuth, async (req, res) => {
  try {
    const { severity, category, status } = req.query as { severity?: string; category?: string; status?: string };
    const id = req.params.id as string;
    const audit = await assertAuditAccess(req, id);
    if (!audit) { res.status(403).json({ error: "Access denied" }); return; }

    const conditions: any[] = [eq(auditIssuesTable.auditId, id)];
    if (severity) conditions.push(eq(auditIssuesTable.severity as any, severity));
    if (category) conditions.push(eq(auditIssuesTable.category as any, category));
    if (status) conditions.push(eq(auditIssuesTable.status as any, status));
    const issues = await db.select().from(auditIssuesTable).where(and(...conditions));
    res.json(issues);
  } catch (err) {
    req.log.error({ err }, "Failed to list issues");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Real audit engine ────────────────────────────────────────────────────────

async function runRealAudit(input: {
  auditId: string;
  clientId: string;
  clientName: string;
  orgId: string | null;
  url: string;
  maxPages: number;
  includePageSpeed: boolean;
  auditType: "seo" | "geo_aeo" | "hybrid";
}) {
  const { auditId, clientId, clientName, orgId, url, maxPages, includePageSpeed, auditType } = input;
  const auditStart = Date.now();
  try {
    logger.info({ auditId, url }, "Starting real SEO crawl");
    await db.update(auditsTable).set({ status: "running", updatedAt: new Date() }).where(eq(auditsTable.id, auditId));

    const crawlResult = await crawlSite(url, {
      maxPages,
      maxDepth: 4,
      rateLimitMs: 300,
      respectRobots: true,
      onProgress: (crawled, queued, currentUrl) => {
        logger.info({ auditId, crawled, queued, currentUrl }, "Crawl progress");
      },
    });

    logger.info({ auditId, pages: crawlResult.pages.length, errors: crawlResult.errors.length }, "Crawl complete");

    const { issues, seoScore } = analyzeCrawlResult(crawlResult);
    logger.info({ auditId, issueCount: issues.length, seoScore }, "SEO analysis complete");

    let aiProviderUsed: string | null = null;
    let aiRecommendationMap = new Map<number, string>();
    try {
      const aiProvider = await getActiveProvider(orgId ?? undefined);
      if (aiProvider) {
        logger.info({ auditId, provider: aiProvider.provider }, "Generating AI recommendations");
        aiRecommendationMap = await generateBatchRecommendations(issues, url, aiProvider, 10);
        aiProviderUsed = `${aiProvider.provider}/${aiProvider.model}`;
      }
    } catch (aiErr) {
      logger.warn({ auditId, err: aiErr }, "AI phase failed, continuing without");
    }

    if (auditType !== "geo_aeo") {
      for (let i = 0; i < issues.length; i++) {
        const issue = issues[i];
        await db.insert(auditIssuesTable).values({
          id: crypto.randomUUID(),
          auditId,
          url: issue.url,
          category: issue.category,
          severity: issue.severity,
          title: issue.title,
          description: issue.description,
          recommendation: issue.recommendation,
          aiRecommendation: aiRecommendationMap.get(i) || null,
          priorityScore: issue.priorityScore,
          affectedElement: issue.affectedElement || null,
          status: "open",
        });
      }
    }

    const aiVisibilityScore = await runGeoAuditPhase({
      auditId,
      auditType,
      clientName,
      url,
      crawlResult,
    });

    if (includePageSpeed) await seedPageSpeedData(auditId, url);

    const scanDurationMs = Date.now() - auditStart;
    await db.update(auditsTable).set({
      status: "completed",
      seoScore,
      aiVisibilityScore,
      crawledPages: crawlResult.pages.length,
      scanDurationMs,
      aiProviderUsed,
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(auditsTable.id, auditId));

    await db.update(clientsTable).set({ seoScore, lastAuditAt: new Date(), updatedAt: new Date() }).where(eq(clientsTable.id, clientId));
    logger.info({ auditId, seoScore, scanDurationMs }, "Audit complete");
  } catch (err) {
    logger.error({ auditId, err }, "Audit failed");
    await db.update(auditsTable).set({ status: "failed", scanDurationMs: Date.now() - auditStart, updatedAt: new Date() }).where(eq(auditsTable.id, auditId));
  }
}

async function runGeoAuditPhase(input: {
  auditId: string;
  auditType: "seo" | "geo_aeo" | "hybrid";
  clientName: string;
  url: string;
  crawlResult: Awaited<ReturnType<typeof crawlSite>>;
}): Promise<number | null> {
  if (process.env.GEO_AEO_ENABLED !== "true" || input.auditType === "seo") return null;

  const scannerResult = runGeoAeoScanners({
    crawlResult: input.crawlResult,
    profile: {
      businessName: input.clientName,
      websiteUrl: input.url,
      targetServices: [],
      targetLocations: [],
      competitors: [],
      proofPoints: [],
      packageTier: "standard",
    },
  });

  for (const assessment of scannerResult.pageAssessments) {
    await db.insert(geoPageAssessmentsTable).values({
      id: crypto.randomUUID(),
      auditId: input.auditId,
      pageUrl: assessment.pageUrl,
      aiCitableScore: assessment.aiCitableScore,
      answerCoverageScore: assessment.answerCoverageScore,
      entityClarityScore: assessment.entityClarityScore,
      proofSignalScore: assessment.proofSignalScore,
      structureScore: assessment.structureScore,
      schemaReadinessScore: assessment.schemaReadinessScore,
      citationReadinessScore: assessment.citationReadinessScore,
      detectedGaps: assessment.detectedGaps,
      recommendedFixes: assessment.recommendedFixes,
      evidence: assessment.evidence,
    });
  }

  for (const issue of scannerResult.issues) {
    await db.insert(auditIssuesTable).values({
      id: crypto.randomUUID(),
      auditId: input.auditId,
      url: issue.url,
      category: issue.category,
      issueType: issue.issueType,
      severity: issue.severity,
      title: issue.title,
      description: issue.description,
      evidence: issue.evidence,
      recommendation: issue.recommendation,
      aiVisibilityImpact: issue.aiVisibilityImpact,
      businessImpact: issue.businessImpact,
      estimatedEffort: issue.estimatedEffort,
      recommendedOwner: issue.recommendedOwner,
      priorityScore: issue.priorityScore,
      status: "open",
    });

    await db.insert(geoRecommendationsTable).values({
      id: crypto.randomUUID(),
      auditId: input.auditId,
      pageUrl: issue.url,
      category: issue.category,
      issueType: issue.issueType,
      title: issue.title,
      evidence: issue.evidence.signals.join("; "),
      recommendation: issue.recommendation,
      aiVisibilityImpact: issue.aiVisibilityImpact,
      businessImpact: issue.businessImpact,
      priorityScore: issue.priorityScore,
      estimatedEffort: issue.estimatedEffort,
      owner: issue.recommendedOwner,
      fiverrPackageTier: "standard",
      status: "draft",
    });
  }

  const score = calculateGeoAeoScore({
    profile: { businessName: input.clientName, websiteUrl: input.url, packageTier: "standard" },
    pageAssessments: scannerResult.pageAssessments,
    recommendations: scannerResult.issues.map((issue) => ({
      issueType: issue.issueType,
      priorityScore: issue.priorityScore,
      title: issue.title,
    })),
  });

  await db.insert(geoScoreSnapshotsTable).values({
    id: crypto.randomUUID(),
    auditId: input.auditId,
    aiVisibilityScore: score.aiVisibilityScore,
    grade: score.grade,
    subScores: score.subScores,
    topRisks: score.topRisks,
    quickWins: score.quickWins,
  });

  return score.aiVisibilityScore;
}

async function insertPageSpeedResult(
  auditId: string,
  url: string,
  device: "mobile" | "desktop",
  metrics: PageSpeedMetrics,
) {
  await db.insert(pageSpeedResultsTable).values({
    id: crypto.randomUUID(),
    auditId,
    url,
    device,
    performanceScore: metrics.performanceScore,
    accessibilityScore: metrics.accessibilityScore,
    bestPracticesScore: metrics.bestPracticesScore,
    seoScore: metrics.seoScore,
    lcp: metrics.lcp,
    fid: metrics.fid,
    cls: metrics.cls,
    fcp: metrics.fcp,
    ttfb: metrics.ttfb,
    speedIndex: metrics.speedIndex,
    totalBlockingTime: metrics.totalBlockingTime,
    tbt: metrics.tbt,
  });
}

async function seedPageSpeedData(auditId: string, url: string) {
  for (const device of ["mobile", "desktop"] as const) {
    const metrics = (await fetchRealPageSpeed(url, device)) ?? syntheticPageSpeed(device);
    await insertPageSpeedResult(auditId, url, device, metrics);
  }
}

export default router;
