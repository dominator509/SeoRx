import { Router } from "express";
import { db, clientsTable, auditsTable, auditIssuesTable } from "@workspace/db";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/dashboard/stats", requireAuth, async (req, res) => {
  try {
    const [totalClients, totalAudits, totalIssues, criticalIssues, resolvedIssues, pendingApprovals] = await Promise.all([
      db.$count(clientsTable),
      db.$count(auditsTable),
      db.$count(auditIssuesTable),
      db.$count(auditIssuesTable, eq(auditIssuesTable.severity, "critical")),
      db.$count(auditIssuesTable, sql`${auditIssuesTable.status} IN ('approved', 'fixed', 'dismissed')`),
      db.$count(auditIssuesTable, eq(auditIssuesTable.status, "open")),
    ]);

    const avgScoreResult = await db
      .select({ avg: sql<number>`AVG(seo_score)` })
      .from(clientsTable)
      .where(sql`seo_score IS NOT NULL`);
    const avgSeoScore = Math.round(avgScoreResult[0]?.avg ?? 0);

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const auditsThisMonth = await db.$count(auditsTable, gte(auditsTable.createdAt, oneMonthAgo));

    res.json({ totalClients, totalAudits, totalIssues, criticalIssues, resolvedIssues, avgSeoScore, auditsThisMonth, pendingApprovals });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/recent-audits", requireAuth, async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 10);
    const audits = await db.select().from(auditsTable).orderBy(desc(auditsTable.createdAt)).limit(limit);
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
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Failed to get recent audits");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/issue-breakdown", requireAuth, async (req, res) => {
  try {
    const bySeverity = await db
      .select({ severity: auditIssuesTable.severity, count: sql<number>`count(*)::int` })
      .from(auditIssuesTable)
      .groupBy(auditIssuesTable.severity);
    const byCategory = await db
      .select({ category: auditIssuesTable.category, count: sql<number>`count(*)::int` })
      .from(auditIssuesTable)
      .groupBy(auditIssuesTable.category);
    res.json({ bySeverity, byCategory });
  } catch (err) {
    req.log.error({ err }, "Failed to get issue breakdown");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/score-trends", requireAuth, async (req, res) => {
  try {
    const days = Number(req.query.days ?? 30);
    const since = new Date();
    since.setDate(since.getDate() - days);
    const trends = await db
      .select({
        date: sql<string>`DATE(${auditsTable.completedAt})`,
        avgScore: sql<number>`AVG(seo_score)`,
        auditCount: sql<number>`count(*)::int`,
      })
      .from(auditsTable)
      .where(and(gte(auditsTable.completedAt, since), sql`seo_score IS NOT NULL`))
      .groupBy(sql`DATE(${auditsTable.completedAt})`);
    res.json(trends);
  } catch (err) {
    req.log.error({ err }, "Failed to get score trends");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
