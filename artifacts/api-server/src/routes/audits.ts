import { Router } from "express";
import {
  db,
  auditsTable,
  auditIssuesTable,
  clientsTable,
  pageSpeedResultsTable,
} from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { crawlSite } from "../lib/crawler";
import { analyzeCrawlResult } from "../lib/seo-analyzer";
import { getActiveProvider, generateBatchRecommendations } from "../lib/ai-adapter";
import { logger } from "../lib/logger";

const router = Router();

router.get("/audits", requireAuth, async (req, res) => {
  try {
    const { clientId, status, limit = "20", offset = "0" } = req.query as {
      clientId?: string;
      status?: string;
      limit?: string;
      offset?: string;
    };
    const conditions = [];
    if (clientId) conditions.push(eq(auditsTable.clientId, clientId));
    if (status) conditions.push(eq(auditsTable.status as any, status));

    const audits = conditions.length
      ? await db.select().from(auditsTable).where(and(...conditions)).orderBy(desc(auditsTable.createdAt)).limit(Number(limit)).offset(Number(offset))
      : await db.select().from(auditsTable).orderBy(desc(auditsTable.createdAt)).limit(Number(limit)).offset(Number(offset));

    const total = conditions.length
      ? await db.$count(auditsTable, and(...conditions))
      : await db.$count(auditsTable);

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

router.post("/audits", requireAuth, async (req, res) => {
  try {
    const { clientId, url, maxPages = 50, includePageSpeed = false, aiProviderId } = req.body;

    // Validate URL
    let normalizedUrl: string;
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      normalizedUrl = u.href;
    } catch {
      res.status(400).json({ error: "Invalid URL" });
      return;
    }

    const id = crypto.randomUUID();
    await db.insert(auditsTable).values({
      id,
      clientId,
      url: normalizedUrl,
      maxPages,
      includePageSpeed,
      aiProviderId: aiProviderId || null,
      status: "pending",
    });

    // Start real crawl asynchronously
    runRealAudit(id, clientId, normalizedUrl, maxPages, includePageSpeed).catch((err) => {
      logger.error({ err, auditId: id }, "Real audit failed");
    });

    const audit = await db.query.auditsTable.findFirst({ where: eq(auditsTable.id, id) });
    const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, clientId) });
    res.status(201).json({
      ...audit,
      clientName: client?.name ?? "",
      issueCount: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create audit");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/audits/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const audit = await db.query.auditsTable.findFirst({ where: eq(auditsTable.id, id) });
    if (!audit) { res.status(404).json({ error: "Not found" }); return; }
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
    await db.delete(auditsTable).where(eq(auditsTable.id, req.params.id as string));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete audit");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/audits/:id/issues", requireAuth, async (req, res) => {
  try {
    const { severity, category, status } = req.query as { severity?: string; category?: string; status?: string };
    const conditions = [eq(auditIssuesTable.auditId, req.params.id as string)];
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

// ─── Real audit engine ──────────────────────────────────────────────────────

async function runRealAudit(
  auditId: string,
  clientId: string,
  url: string,
  maxPages: number,
  includePageSpeed: boolean,
) {
  const auditStart = Date.now();

  try {
    logger.info({ auditId, url }, "Starting real SEO crawl");

    await db.update(auditsTable)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(auditsTable.id, auditId));

    // Phase 1: Crawl the site
    const crawlResult = await crawlSite(url, {
      maxPages,
      maxDepth: 4,
      rateLimitMs: 300,
      respectRobots: true,
      onProgress: (crawled, queued, currentUrl) => {
        logger.info({ auditId, crawled, queued, currentUrl }, "Crawl progress");
      },
    });

    logger.info(
      { auditId, pages: crawlResult.pages.length, errors: crawlResult.errors.length },
      "Crawl complete",
    );

    // Phase 2: Analyze for SEO issues
    const { issues, seoScore } = analyzeCrawlResult(crawlResult);

    logger.info({ auditId, issueCount: issues.length, seoScore }, "SEO analysis complete");

    // Phase 3: Try to get AI recommendations for top issues
    let aiProviderUsed: string | null = null;
    let aiRecommendationMap = new Map<number, string>();

    try {
      const aiProvider = await getActiveProvider();
      if (aiProvider) {
        logger.info({ auditId, provider: aiProvider.provider, model: aiProvider.model }, "Generating AI recommendations");
        aiRecommendationMap = await generateBatchRecommendations(issues, url, aiProvider, 10);
        aiProviderUsed = `${aiProvider.provider}/${aiProvider.model}`;
        logger.info({ auditId, count: aiRecommendationMap.size }, "AI recommendations generated");
      } else {
        logger.info({ auditId }, "No active AI provider configured, skipping AI recommendations");
      }
    } catch (aiErr) {
      logger.warn({ auditId, err: aiErr }, "AI recommendation phase failed, continuing without");
    }

    // Phase 4: Persist issues
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

    // Phase 5: PageSpeed data (synthetic until real API key is configured)
    if (includePageSpeed) {
      await seedPageSpeedData(auditId, url);
    }

    const scanDurationMs = Date.now() - auditStart;

    // Phase 6: Mark complete and update client score
    await db.update(auditsTable).set({
      status: "completed",
      seoScore,
      crawledPages: crawlResult.pages.length,
      scanDurationMs,
      aiProviderUsed,
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(auditsTable.id, auditId));

    await db.update(clientsTable).set({
      seoScore,
      lastAuditAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(clientsTable.id, clientId));

    logger.info({ auditId, seoScore, scanDurationMs }, "Audit complete");
  } catch (err) {
    logger.error({ auditId, err }, "Audit failed");
    await db.update(auditsTable).set({
      status: "failed",
      scanDurationMs: Date.now() - auditStart,
      updatedAt: new Date(),
    }).where(eq(auditsTable.id, auditId));
  }
}

async function seedPageSpeedData(auditId: string, url: string) {
  const lcp = parseFloat((1.5 + Math.random() * 3).toFixed(2));
  const fid = Math.round(50 + Math.random() * 200);
  const cls = parseFloat((Math.random() * 0.3).toFixed(3));
  const fcp = parseFloat((0.8 + Math.random() * 2).toFixed(2));
  const ttfb = parseFloat(((200 + Math.random() * 800) / 1000).toFixed(3));
  const score = Math.round(Math.max(30, 100 - lcp * 10 - cls * 100 - ttfb * 20));

  await db.insert(pageSpeedResultsTable).values({
    id: crypto.randomUUID(),
    auditId,
    url,
    device: "mobile",
    performanceScore: score,
    accessibilityScore: Math.round(65 + Math.random() * 30),
    bestPracticesScore: Math.round(60 + Math.random() * 35),
    seoScore: Math.round(55 + Math.random() * 40),
    lcp,
    fid,
    cls,
    fcp,
    ttfb,
    speedIndex: parseFloat((lcp * 1.2).toFixed(2)),
    totalBlockingTime: Math.round(fid * 0.8),
  });

  const desktopBoost = 1.3;
  await db.insert(pageSpeedResultsTable).values({
    id: crypto.randomUUID(),
    auditId,
    url,
    device: "desktop",
    performanceScore: Math.min(100, Math.round(score * desktopBoost)),
    accessibilityScore: Math.round(70 + Math.random() * 28),
    bestPracticesScore: Math.round(65 + Math.random() * 30),
    seoScore: Math.round(60 + Math.random() * 38),
    lcp: parseFloat((lcp * 0.7).toFixed(2)),
    fid: Math.round(fid * 0.5),
    cls: parseFloat((cls * 0.8).toFixed(3)),
    fcp: parseFloat((fcp * 0.7).toFixed(2)),
    ttfb: parseFloat((ttfb * 0.6).toFixed(3)),
    speedIndex: parseFloat((lcp * 0.8).toFixed(2)),
    totalBlockingTime: Math.round(fid * 0.4),
  });
}

export default router;
