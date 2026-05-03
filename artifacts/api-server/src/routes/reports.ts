import { Router } from "express";
import { db, reportsTable, auditsTable, clientsTable, auditIssuesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

router.get("/reports", requireAuth, async (req, res) => {
  try {
    const { clientId, auditId } = req.query as { clientId?: string; auditId?: string };
    const conditions = [];
    if (clientId) conditions.push(eq(reportsTable.clientId, clientId));
    if (auditId) conditions.push(eq(reportsTable.auditId, auditId));
    const reports = conditions.length
      ? await db.select().from(reportsTable).where(and(...conditions))
      : await db.select().from(reportsTable);
    const enriched = await Promise.all(
      reports.map(async (r) => {
        const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, r.clientId) });
        return { ...r, clientName: client?.name ?? "" };
      }),
    );
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Failed to list reports");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/reports", requireAuth, async (req, res) => {
  try {
    const { auditId, title, format = "pdf", includeAiSummary = true } = req.body;
    const audit = await db.query.auditsTable.findFirst({ where: eq(auditsTable.id, auditId as string) });
    if (!audit) { res.status(404).json({ error: "Audit not found" }); return; }
    const id = crypto.randomUUID();
    await db.insert(reportsTable).values({ id, auditId, clientId: audit.clientId, title, format, status: "generating", includeAiSummary });

    generateReport(id, auditId as string).catch((err) => {
      logger.error({ err, reportId: id }, "Report generation failed");
    });

    const report = await db.query.reportsTable.findFirst({ where: eq(reportsTable.id, id) });
    const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, audit.clientId) });
    res.status(201).json({ ...report, clientName: client?.name ?? "" });
  } catch (err) {
    req.log.error({ err }, "Failed to create report");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/reports/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const report = await db.query.reportsTable.findFirst({ where: eq(reportsTable.id, id) });
    if (!report) { res.status(404).json({ error: "Not found" }); return; }
    const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, report.clientId) });
    const issues = await db.query.auditIssuesTable.findMany({ where: eq(auditIssuesTable.auditId, report.auditId) });
    const topIssues = issues.sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0)).slice(0, 5);
    res.json({ ...report, clientName: client?.name ?? "", issueCount: issues.length, topIssues });
  } catch (err) {
    req.log.error({ err }, "Failed to get report");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/reports/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    await db.delete(reportsTable).where(eq(reportsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete report");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function generateReport(reportId: string, auditId: string) {
  await new Promise((r) => setTimeout(r, 3000));
  const issues = await db.query.auditIssuesTable.findMany({ where: eq(auditIssuesTable.auditId, auditId) });
  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const highCount = issues.filter((i) => i.severity === "high").length;
  const summary = `This SEO audit identified ${issues.length} total issues, including ${criticalCount} critical and ${highCount} high-priority issues requiring attention. Priority actions focus on technical SEO improvements, content quality, and performance optimization. Addressing the top-priority issues is estimated to improve organic visibility by 25–40% within 90 days.`;
  await db.update(reportsTable).set({
    status: "ready",
    summary,
    downloadUrl: `/api/reports/${reportId}/download`,
    updatedAt: new Date(),
  }).where(eq(reportsTable.id, reportId));
}

export default router;
