import { Router } from "express";
import { db, pageSpeedResultsTable, auditsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, assertAuditAccess } from "../lib/rbac";
import { logger } from "../lib/logger";

const router = Router();

interface PageSpeedApiResponse {
  lighthouseResult?: {
    categories?: {
      performance?: { score?: number };
      accessibility?: { score?: number };
      "best-practices"?: { score?: number };
      seo?: { score?: number };
    };
    audits?: {
      "first-contentful-paint"?: { numericValue?: number };
      "largest-contentful-paint"?: { numericValue?: number };
      "cumulative-layout-shift"?: { numericValue?: number };
      "total-blocking-time"?: { numericValue?: number };
      "speed-index"?: { numericValue?: number };
    };
  };
  loadingExperience?: {
    metrics?: {
      FIRST_CONTENTFUL_PAINT_MS?: { percentile?: number };
      LARGEST_CONTENTFUL_PAINT_MS?: { percentile?: number };
      FIRST_INPUT_DELAY_MS?: { percentile?: number };
      CUMULATIVE_LAYOUT_SHIFT_SCORE?: { percentile?: number };
      EXPERIMENTAL_TIME_TO_FIRST_BYTE?: { percentile?: number };
    };
  };
}

interface PageSpeedMetrics {
  performanceScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  seoScore: number;
  /** seconds */
  lcp: number | null;
  /** milliseconds */
  fid: number | null;
  /** ratio */
  cls: number | null;
  /** seconds */
  fcp: number | null;
  /** seconds */
  ttfb: number | null;
  /** seconds */
  speedIndex: number | null;
  /** milliseconds */
  totalBlockingTime: number | null;
  /** milliseconds (alias stored alongside totalBlockingTime) */
  tbt: number | null;
}

async function fetchRealPageSpeed(
  url: string,
  strategy: "mobile" | "desktop",
): Promise<PageSpeedMetrics | null> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) return null;

  const apiUrl = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  apiUrl.searchParams.set("url", url);
  apiUrl.searchParams.set("strategy", strategy);
  apiUrl.searchParams.set("key", apiKey);
  ["performance", "accessibility", "best-practices", "seo"].forEach((c) =>
    apiUrl.searchParams.append("category", c),
  );

  try {
    const resp = await fetch(apiUrl.href, { signal: AbortSignal.timeout(30000) });
    if (!resp.ok) {
      logger.warn({ status: resp.status, url }, "PageSpeed API returned non-200");
      return null;
    }
    const data = (await resp.json()) as PageSpeedApiResponse;
    const cats = data.lighthouseResult?.categories;
    const audits = data.lighthouseResult?.audits;
    const crux = data.loadingExperience?.metrics;

    const score = (v?: number): number =>
      v == null || Number.isNaN(v) ? 0 : Math.round(v * 100);
    // Convert ms → seconds, return null if missing
    const sec = (ms?: number): number | null =>
      ms == null || Number.isNaN(ms) || ms <= 0 ? null : parseFloat((ms / 1000).toFixed(2));
    const ratio = (v?: number): number | null =>
      v == null || Number.isNaN(v) ? null : parseFloat(v.toFixed(3));

    const lcp = sec(crux?.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? audits?.["largest-contentful-paint"]?.numericValue);
    const fcp = sec(crux?.FIRST_CONTENTFUL_PAINT_MS?.percentile ?? audits?.["first-contentful-paint"]?.numericValue);
    const ttfb = sec(crux?.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.percentile);
    const clsRaw = crux?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile ?? audits?.["cumulative-layout-shift"]?.numericValue;
    // CLS from CrUX is *100, from lighthouse is already a ratio
    const cls = clsRaw != null
      ? ratio(crux?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile != null ? clsRaw / 100 : clsRaw)
      : null;
    const fid = crux?.FIRST_INPUT_DELAY_MS?.percentile ?? null;
    const tbtRaw = audits?.["total-blocking-time"]?.numericValue;
    const tbt = tbtRaw != null ? Math.round(tbtRaw) : null;
    const si = sec(audits?.["speed-index"]?.numericValue);

    return {
      performanceScore: score(cats?.performance?.score),
      accessibilityScore: score(cats?.accessibility?.score),
      bestPracticesScore: score(cats?.["best-practices"]?.score),
      seoScore: score(cats?.seo?.score),
      lcp,
      fid,
      cls,
      fcp,
      ttfb,
      speedIndex: si,
      totalBlockingTime: tbt,
      tbt,
    };
  } catch (err) {
    logger.warn({ err, url }, "PageSpeed API request failed");
    return null;
  }
}

function syntheticPageSpeed(device: "mobile" | "desktop"): PageSpeedMetrics {
  // All time values match DB schema units:
  //   lcp, fcp, ttfb, speedIndex → seconds
  //   tbt, totalBlockingTime, fid → milliseconds
  const lcpSec = parseFloat((1.5 + Math.random() * 3.5).toFixed(2));
  const cls = parseFloat((Math.random() * 0.25).toFixed(3));
  const fcpSec = parseFloat((0.8 + Math.random() * 2).toFixed(2));
  const ttfbSec = parseFloat(((200 + Math.random() * 700) / 1000).toFixed(3));
  const fidMs = Math.round(30 + Math.random() * 200);
  const tbtMs = Math.round(fidMs * 0.8);
  const perfBase = Math.max(30, 100 - lcpSec * 10 - cls * 80 - ttfbSec * 20);
  const mult = device === "desktop" ? 1.25 : 1;

  const lcp = device === "desktop" ? parseFloat((lcpSec * 0.7).toFixed(2)) : lcpSec;
  const fcp = device === "desktop" ? parseFloat((fcpSec * 0.7).toFixed(2)) : fcpSec;
  const ttfb = device === "desktop" ? parseFloat((ttfbSec * 0.6).toFixed(3)) : ttfbSec;
  const tbt = device === "desktop" ? Math.round(tbtMs * 0.5) : tbtMs;
  const fid = device === "desktop" ? Math.round(fidMs * 0.5) : fidMs;

  return {
    performanceScore: Math.min(100, Math.round(perfBase * mult)),
    accessibilityScore: Math.round(65 + Math.random() * 30),
    bestPracticesScore: Math.round(60 + Math.random() * 35),
    seoScore: Math.round(55 + Math.random() * 40),
    lcp,
    fid,
    cls: device === "desktop" ? parseFloat((cls * 0.8).toFixed(3)) : cls,
    fcp,
    ttfb,
    speedIndex: parseFloat((lcp * (device === "desktop" ? 0.85 : 1.2)).toFixed(2)),
    totalBlockingTime: tbt,
    tbt,
  };
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
      where: eq(pageSpeedResultsTable.auditId, auditId),
    });

    if (existing) {
      // Include isReal: if tbt has a value it was likely synthetic since real data sets it explicitly
      // Use the presence of lcp/fcp as signal — if these are null the row was from old code
      const isReal = existing.lcp != null && existing.fcp != null && existing.tbt != null;
      res.json({ ...existing, isReal: false }); // Mark cached rows honestly — we can't know after the fact
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

    res.json({ ...saved, isReal });
  } catch (err) {
    req.log.error({ err }, "Failed to get PageSpeed results");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
