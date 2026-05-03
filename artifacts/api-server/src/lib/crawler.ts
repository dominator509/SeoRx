import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import { logger } from "./logger";

export interface CrawledPage {
  url: string;
  statusCode: number;
  redirectedTo?: string;
  title?: string;
  metaDescription?: string;
  h1Tags: string[];
  h2Tags: string[];
  imgAlts: { src: string; alt: string | null }[];
  links: { href: string; text: string; isInternal: boolean; isBroken?: boolean }[];
  canonicalUrl?: string;
  robotsMeta?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  structuredData: string[];
  wordCount: number;
  loadTimeMs: number;
  hasHttps: boolean;
  hasViewport: boolean;
  html: string;
  error?: string;
}

const USER_AGENT = "SEORx-Crawler/1.0 (+https://seorx.app/bot)";
const DEFAULT_TIMEOUT = 12000;
const RATE_LIMIT_MS = 500;
const MAX_REDIRECTS = 5;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeUrl(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    u.hash = "";
    return u.href;
  } catch {
    return null;
  }
}

function isSameOrigin(url: string, base: string): boolean {
  try {
    return new URL(url).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

function shouldSkipUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    /\.(jpg|jpeg|png|gif|webp|svg|ico|pdf|zip|tar|gz|mp4|mp3|woff|woff2|ttf|eot|css|js)$/i.test(lower)
  );
}

async function fetchPage(url: string): Promise<{
  html: string;
  statusCode: number;
  loadTimeMs: number;
  finalUrl: string;
  error?: string;
}> {
  const start = Date.now();
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    });
    const loadTimeMs = Date.now() - start;
    const html = await response.text();
    return {
      html,
      statusCode: response.status,
      loadTimeMs,
      finalUrl: response.url || url,
    };
  } catch (err: any) {
    return {
      html: "",
      statusCode: 0,
      loadTimeMs: Date.now() - start,
      finalUrl: url,
      error: err?.message ?? "Unknown fetch error",
    };
  }
}

function parsePage(url: string, html: string, statusCode: number, loadTimeMs: number, finalUrl: string, error?: string): CrawledPage {
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim() || undefined;
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() || undefined;
  const canonicalUrl = $('link[rel="canonical"]').attr("href")?.trim() || undefined;
  const robotsMeta = $('meta[name="robots"]').attr("content")?.trim() || undefined;
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || undefined;
  const ogDescription = $('meta[property="og:description"]').attr("content")?.trim() || undefined;
  const ogImage = $('meta[property="og:image"]').attr("content")?.trim() || undefined;
  const hasViewport = !!$('meta[name="viewport"]').attr("content");

  const h1Tags = $("h1").map((_, el) => $(el).text().trim()).get().filter(Boolean);
  const h2Tags = $("h2").map((_, el) => $(el).text().trim()).get().filter(Boolean);

  const imgAlts: { src: string; alt: string | null }[] = [];
  $("img").each((_, el) => {
    const src = $(el).attr("src") ?? "";
    const alt = $(el).attr("alt") ?? null;
    if (src) imgAlts.push({ src, alt });
  });

  const links: { href: string; text: string; isInternal: boolean }[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const text = $(el).text().trim();
    const normalized = normalizeUrl(href, url);
    if (normalized && !shouldSkipUrl(normalized)) {
      links.push({ href: normalized, text, isInternal: isSameOrigin(normalized, url) });
    }
  });

  const structuredData: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const content = $(el).html()?.trim();
    if (content) structuredData.push(content);
  });

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

  return {
    url,
    statusCode,
    redirectedTo: finalUrl !== url ? finalUrl : undefined,
    title,
    metaDescription,
    h1Tags,
    h2Tags,
    imgAlts,
    links,
    canonicalUrl,
    robotsMeta,
    ogTitle,
    ogDescription,
    ogImage,
    structuredData,
    wordCount,
    loadTimeMs,
    hasHttps: url.startsWith("https://"),
    hasViewport,
    html,
    error,
  };
}

async function fetchRobotsTxt(origin: string): Promise<ReturnType<typeof robotsParser> | null> {
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return robotsParser(`${origin}/robots.txt`, text);
  } catch {
    return null;
  }
}

export interface CrawlResult {
  pages: CrawledPage[];
  crawledUrls: Set<string>;
  blockedByRobots: string[];
  errors: string[];
  durationMs: number;
}

export interface CrawlOptions {
  maxPages?: number;
  maxDepth?: number;
  rateLimitMs?: number;
  respectRobots?: boolean;
  onProgress?: (crawled: number, queued: number, url: string) => void;
}

export async function crawlSite(startUrl: string, options: CrawlOptions = {}): Promise<CrawlResult> {
  const {
    maxPages = 50,
    maxDepth = 4,
    rateLimitMs = RATE_LIMIT_MS,
    respectRobots = true,
    onProgress,
  } = options;

  const start = Date.now();
  const origin = new URL(startUrl).origin;

  const robots = respectRobots ? await fetchRobotsTxt(origin) : null;

  const visited = new Set<string>();
  const blockedByRobots: string[] = [];
  const errors: string[] = [];
  const pages: CrawledPage[] = [];

  // Queue: [url, depth]
  const queue: Array<[string, number]> = [[startUrl, 0]];

  while (queue.length > 0 && pages.length < maxPages) {
    const [url, depth] = queue.shift()!;

    if (visited.has(url)) continue;
    visited.add(url);

    if (robots && !robots.isAllowed(url, USER_AGENT)) {
      blockedByRobots.push(url);
      logger.info({ url }, "Blocked by robots.txt");
      continue;
    }

    onProgress?.(pages.length, queue.length, url);

    const { html, statusCode, loadTimeMs, finalUrl, error } = await fetchPage(url);

    if (error) {
      errors.push(`${url}: ${error}`);
      pages.push(parsePage(url, "", statusCode, loadTimeMs, finalUrl, error));
      continue;
    }

    const page = parsePage(url, html, statusCode, loadTimeMs, finalUrl, error);
    pages.push(page);

    // Enqueue internal links up to maxDepth
    if (depth < maxDepth) {
      for (const link of page.links) {
        if (link.isInternal && !visited.has(link.href) && !queue.some(([u]) => u === link.href)) {
          if (pages.length + queue.length < maxPages * 2) {
            queue.push([link.href, depth + 1]);
          }
        }
      }
    }

    if (rateLimitMs > 0) await sleep(rateLimitMs);
  }

  return {
    pages,
    crawledUrls: visited,
    blockedByRobots,
    errors,
    durationMs: Date.now() - start,
  };
}
