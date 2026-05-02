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
    const { clientId, url, maxPages = 100, includePageSpeed = false, aiProviderId } = req.body;
    const id = crypto.randomUUID();
    await db.insert(auditsTable).values({ id, clientId, url, maxPages, includePageSpeed, aiProviderId, status: "pending" });

    // Start async audit simulation
    runAuditSimulation(id, clientId, url).catch(console.error);

    const audit = await db.query.auditsTable.findFirst({ where: eq(auditsTable.id, id) });
    const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, clientId) });
    res.status(201).json({ ...audit, clientName: client?.name ?? "", issueCount: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to create audit");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/audits/:id", requireAuth, async (req, res) => {
  try {
    const audit = await db.query.auditsTable.findFirst({ where: eq(auditsTable.id, req.params.id) });
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
    await db.delete(auditsTable).where(eq(auditsTable.id, req.params.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete audit");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/audits/:id/issues", requireAuth, async (req, res) => {
  try {
    const { severity, category, status } = req.query as { severity?: string; category?: string; status?: string };
    const conditions = [eq(auditIssuesTable.auditId, req.params.id)];
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

// Simulate an SEO audit with realistic issues
async function runAuditSimulation(auditId: string, clientId: string, url: string) {
  await new Promise((r) => setTimeout(r, 2000));
  await db.update(auditsTable).set({ status: "running" }).where(eq(auditsTable.id, auditId));

  const sampleIssues = [
    { category: "meta", severity: "critical", title: "Missing meta description", description: "The page lacks a meta description tag which is important for SEO.", recommendation: "Add a unique meta description between 150-160 characters.", priorityScore: 95 },
    { category: "meta", severity: "high", title: "Duplicate title tags", description: "Multiple pages share the same title tag, causing keyword cannibalization.", recommendation: "Ensure each page has a unique, descriptive title tag.", priorityScore: 80 },
    { category: "content", severity: "high", title: "Thin content detected", description: "Several pages have fewer than 300 words, which may signal low quality to search engines.", recommendation: "Expand page content with relevant, valuable information for users.", priorityScore: 75 },
    { category: "performance", severity: "critical", title: "Slow page load time", description: "Page loads in over 5 seconds, significantly impacting user experience and rankings.", recommendation: "Optimize images, enable compression, and leverage browser caching.", priorityScore: 90 },
    { category: "links", severity: "medium", title: "Broken internal links", description: "3 internal links return 404 errors, harming crawlability and user experience.", recommendation: "Fix or redirect all broken internal links.", priorityScore: 60 },
    { category: "structured_data", severity: "medium", title: "Missing structured data", description: "No schema.org markup found. Structured data can enhance SERP appearance.", recommendation: "Implement relevant schema markup (Organization, LocalBusiness, Article, etc.).", priorityScore: 55 },
    { category: "mobile", severity: "high", title: "Non-responsive design elements", description: "Some UI elements overflow on mobile viewports, degrading mobile experience.", recommendation: "Ensure all elements are mobile-responsive using flexible layouts.", priorityScore: 72 },
    { category: "security", severity: "medium", title: "Mixed content warnings", description: "HTTP resources loaded on HTTPS pages trigger security warnings.", recommendation: "Migrate all resources to HTTPS to eliminate mixed content.", priorityScore: 50 },
    { category: "crawlability", severity: "low", title: "Large sitemap file", description: "The XML sitemap exceeds recommended limits and may slow indexing.", recommendation: "Split the sitemap into multiple smaller sitemaps.", priorityScore: 30 },
    { category: "meta", severity: "low", title: "Missing OG tags", description: "Open Graph tags are absent, affecting social media sharing appearance.", recommendation: "Add og:title, og:description, og:image to all key pages.", priorityScore: 35 },
  ];

  for (const issue of sampleIssues) {
    await db.insert(auditIssuesTable).values({
      id: crypto.randomUUID(),
      auditId,
      url,
      category: issue.category as any,
      severity: issue.severity as any,
      title: issue.title,
      description: issue.description,
      recommendation: issue.recommendation,
      aiRecommendation: `AI analysis: ${issue.recommendation} Focus on ${issue.category} improvements for maximum impact.`,
      priorityScore: issue.priorityScore,
      status: "open",
    });
  }

  const seoScore = Math.round(40 + Math.random() * 40);
  await db.update(auditsTable).set({
    status: "completed",
    seoScore,
    crawledPages: Math.floor(10 + Math.random() * 90),
    scanDurationMs: Math.floor(2000 + Math.random() * 5000),
    completedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(auditsTable.id, auditId));

  await db.update(clientsTable).set({
    seoScore,
    lastAuditAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(clientsTable.id, clientId));
}

export default router;
