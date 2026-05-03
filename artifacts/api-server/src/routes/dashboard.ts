import { Router } from "express";
import { db, clientsTable, auditsTable, auditIssuesTable } from "@workspace/db";
import { eq, and, gte, sql, desc, inArray } from "drizzle-orm";
import { requireAuth, getUserOrgIds } from "../lib/rbac";

const router = Router();

router.get("/dashboard/stats", requireAuth, async (req, res) => {
  try {
    const orgIds = getUserOrgIds(req);
    if (orgIds.length === 0) {
      res.json({ totalClients: 0, totalAudits: 0, totalIssues: 0, criticalIssues: 0, resolvedIssues: 0, avgSeoScore: 0, auditsThisMonth: 0, pendingApprovals: 0 });
      return;
    }

    // Get clients scoped to user's orgs
    const clients = await db.select({ id: clientsTable.id }).from(clientsTable).where(inArray(clientsTable.orgId, orgIds));
    const clientIds = clients.map((c) => c.id);

    const totalClients = clients.length;

    if (clientIds.length === 0) {
      res.json({ totalClients, totalAudits: 0, totalIssues: 0, criticalIssues: 0, resolvedIssues: 0, avgSeoScore: 0, auditsThisMonth: 0, pendingApprovals: 0 });
      return;
    }

    const [totalAudits, oneMonthAgoAudits] = await Promise.all([
      db.$count(auditsTable, inArray(auditsTable.clientId, clientIds)),
      db.$count(auditsTable, and(inArray(auditsTable.clientId, clientIds), gte(auditsTable.createdAt, new Date(Date.now() - 30 * 86400_000)))),
    ]);

    // Get audit IDs for this user's clients
    const audits = await db.select({ id: auditsTable.id }).from(auditsTable).where(inArray(auditsTable.clientId, clientIds));
    const auditIds = audits.map((a) => a.id);

    const [totalIssues, criticalIssues, resolvedIssues, pendingApprovals] = auditIds.length > 0
      ? await Promise.all([
          db.$count(auditIssuesTable, inArray(auditIssuesTable.auditId, auditIds)),
          db.$count(auditIssuesTable, and(inArray(auditIssuesTable.auditId, auditIds), eq(auditIssuesTable.severity, "critical"))),
          db.$count(auditIssuesTable, and(inArray(auditIssuesTable.auditId, auditIds), sql`${auditIssuesTable.status} IN ('approved', 'fixed', 'dismissed')`)),
          db.$count(auditIssuesTable, and(inArray(auditIssuesTable.auditId, auditIds), eq(auditIssuesTable.status, "open"))),
        ])
      : [0, 0, 0, 0];

    const avgScoreResult = await db
      .select({ avg: sql<number>`AVG(seo_score)` })
      .from(clientsTable)
      .where(and(inArray(clientsTable.id, clientIds), sql`seo_score IS NOT NULL`));
    const avgSeoScore = Math.round(avgScoreResult[0]?.avg ?? 0);

    res.json({ totalClients, totalAudits, totalIssues, criticalIssues, resolvedIssues, avgSeoScore, auditsThisMonth: oneMonthAgoAudits, pendingApprovals });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/recent-audits", requireAuth, async (req, res) => {
  try {
    const orgIds = getUserOrgIds(req);
    const limit = Number(req.query.limit ?? 10);
    if (orgIds.length === 0) { res.json([]); return; }

    const clients = await db.select({ id: clientsTable.id }).from(clientsTable).where(inArray(clientsTable.orgId, orgIds));
    const clientIds = clients.map((c) => c.id);
    if (clientIds.length === 0) { res.json([]); return; }

    const audits = await db
      .select().from(auditsTable)
      .where(inArray(auditsTable.clientId, clientIds))
      .orderBy(desc(auditsTable.createdAt))
      .limit(limit);

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
    const orgIds = getUserOrgIds(req);
    if (orgIds.length === 0) { res.json({ bySeverity: [], byCategory: [] }); return; }

    const clients = await db.select({ id: clientsTable.id }).from(clientsTable).where(inArray(clientsTable.orgId, orgIds));
    const clientIds = clients.map((c) => c.id);
    if (clientIds.length === 0) { res.json({ bySeverity: [], byCategory: [] }); return; }

    const audits = await db.select({ id: auditsTable.id }).from(auditsTable).where(inArray(auditsTable.clientId, clientIds));
    const auditIds = audits.map((a) => a.id);
    if (auditIds.length === 0) { res.json({ bySeverity: [], byCategory: [] }); return; }

    const [bySeverity, byCategory] = await Promise.all([
      db.select({ severity: auditIssuesTable.severity, count: sql<number>`count(*)::int` })
        .from(auditIssuesTable).where(inArray(auditIssuesTable.auditId, auditIds)).groupBy(auditIssuesTable.severity),
      db.select({ category: auditIssuesTable.category, count: sql<number>`count(*)::int` })
        .from(auditIssuesTable).where(inArray(auditIssuesTable.auditId, auditIds)).groupBy(auditIssuesTable.category),
    ]);
    res.json({ bySeverity, byCategory });
  } catch (err) {
    req.log.error({ err }, "Failed to get issue breakdown");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/score-trends", requireAuth, async (req, res) => {
  try {
    const orgIds = getUserOrgIds(req);
    const days = Number(req.query.days ?? 30);
    if (orgIds.length === 0) { res.json([]); return; }

    const clients = await db.select({ id: clientsTable.id }).from(clientsTable).where(inArray(clientsTable.orgId, orgIds));
    const clientIds = clients.map((c) => c.id);
    if (clientIds.length === 0) { res.json([]); return; }

    const since = new Date(Date.now() - days * 86400_000);
    const trends = await db
      .select({
        date: sql<string>`DATE(${auditsTable.completedAt})`,
        avgScore: sql<number>`AVG(seo_score)`,
        auditCount: sql<number>`count(*)::int`,
      })
      .from(auditsTable)
      .where(and(inArray(auditsTable.clientId, clientIds), gte(auditsTable.completedAt, since), sql`seo_score IS NOT NULL`))
      .groupBy(sql`DATE(${auditsTable.completedAt})`);
    res.json(trends);
  } catch (err) {
    req.log.error({ err }, "Failed to get score trends");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
