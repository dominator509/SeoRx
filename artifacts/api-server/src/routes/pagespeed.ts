import { Router } from "express";
import { db, pageSpeedResultsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth, assertAuditAccess } from "../lib/rbac";
import { fetchRealPageSpeed, syntheticPageSpeed } from "../lib/pagespeed";

const router = Router();
const optionalMetricFields = ["fcp", "lcp", "cls", "tbt", "ttfb"] as const;

function pageSpeedResponse(result: typeof pageSpeedResultsTable.$inferSelect | undefined, isReal: boolean) {
  if (!result) return { isReal };

  const response: Record<string, unknown> = { ...result, isReal };
  for (const field of optionalMetricFields) {
    if (response[field] == null) {
      delete response[field];
    }
  }
  return response;
}

router.get("/pagespeed/:auditId", requireAuth, async (req, res) => {
  try {
    const auditId = req.params.auditId as string;
    const { device = "mobile" } = req.query as { device?: string };
    const deviceType = device === "desktop" ? "desktop" : "mobile";

    const audit = await assertAuditAccess(req, auditId);
    if (!audit) {
      res.status(404).json({ error: "Not found or access denied" });
      return;
    }

    const existing = await db.query.pageSpeedResultsTable.findFirst({
      where: and(eq(pageSpeedResultsTable.auditId, auditId), eq(pageSpeedResultsTable.device, deviceType)),
    });

    if (existing) {
      res.json(pageSpeedResponse(existing, false));
      return;
    }

    const apiData = await fetchRealPageSpeed(audit.url, deviceType);
    const metrics = apiData ?? syntheticPageSpeed(deviceType);
    const isReal = !!apiData;

    const id = crypto.randomUUID();
    await db.insert(pageSpeedResultsTable).values({
      id,
      auditId,
      url: audit.url,
      device: deviceType,
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

    const saved = await db.query.pageSpeedResultsTable.findFirst({
      where: eq(pageSpeedResultsTable.id, id),
    });

    res.json(pageSpeedResponse(saved, isReal));
  } catch (err) {
    req.log.error({ err }, "Failed to get PageSpeed results");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
