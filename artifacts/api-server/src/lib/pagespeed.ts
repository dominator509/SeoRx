import { logger } from "./logger";

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

export interface PageSpeedMetrics {
  performanceScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  seoScore: number;
  lcp: number | null;
  fid: number | null;
  cls: number | null;
  fcp: number | null;
  ttfb: number | null;
  speedIndex: number | null;
  totalBlockingTime: number | null;
  tbt: number | null;
}

export async function fetchRealPageSpeed(
  url: string,
  strategy: "mobile" | "desktop",
): Promise<PageSpeedMetrics | null> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) return null;

  const apiUrl = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  apiUrl.searchParams.set("url", url);
  apiUrl.searchParams.set("strategy", strategy);
  apiUrl.searchParams.set("key", apiKey);
  ["performance", "accessibility", "best-practices", "seo"].forEach((category) =>
    apiUrl.searchParams.append("category", category),
  );

  try {
    const resp = await fetch(apiUrl.href, { signal: AbortSignal.timeout(30000) });
    if (!resp.ok) {
      logger.warn({ status: resp.status, url, strategy }, "PageSpeed API returned non-200");
      return null;
    }
    const data = (await resp.json()) as PageSpeedApiResponse;
    const cats = data.lighthouseResult?.categories;
    const audits = data.lighthouseResult?.audits;
    const crux = data.loadingExperience?.metrics;

    const score = (v?: number): number =>
      v == null || Number.isNaN(v) ? 0 : Math.round(v * 100);
    const sec = (ms?: number): number | null =>
      ms == null || Number.isNaN(ms) || ms <= 0 ? null : parseFloat((ms / 1000).toFixed(2));
    const ratio = (v?: number): number | null =>
      v == null || Number.isNaN(v) ? null : parseFloat(v.toFixed(3));

    const clsRaw =
      crux?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile ??
      audits?.["cumulative-layout-shift"]?.numericValue;
    const cls = clsRaw != null
      ? ratio(crux?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile != null ? clsRaw / 100 : clsRaw)
      : null;
    const tbtRaw = audits?.["total-blocking-time"]?.numericValue;
    const tbt = tbtRaw != null ? Math.round(tbtRaw) : null;

    return {
      performanceScore: score(cats?.performance?.score),
      accessibilityScore: score(cats?.accessibility?.score),
      bestPracticesScore: score(cats?.["best-practices"]?.score),
      seoScore: score(cats?.seo?.score),
      lcp: sec(crux?.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? audits?.["largest-contentful-paint"]?.numericValue),
      fid: crux?.FIRST_INPUT_DELAY_MS?.percentile ?? null,
      cls,
      fcp: sec(crux?.FIRST_CONTENTFUL_PAINT_MS?.percentile ?? audits?.["first-contentful-paint"]?.numericValue),
      ttfb: sec(crux?.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.percentile),
      speedIndex: sec(audits?.["speed-index"]?.numericValue),
      totalBlockingTime: tbt,
      tbt,
    };
  } catch (err) {
    logger.warn({ err, url, strategy }, "PageSpeed API request failed");
    return null;
  }
}

export function syntheticPageSpeed(device: "mobile" | "desktop"): PageSpeedMetrics {
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
