import type { CrawledPage, CrawlResult } from "./crawler";

export interface SeoIssue {
  url: string;
  category: "meta" | "content" | "performance" | "links" | "structured_data" | "mobile" | "security" | "crawlability";
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  recommendation: string;
  priorityScore: number;
  affectedElement?: string;
}

function priorityScore(severity: string, count = 1): number {
  const base: Record<string, number> = { critical: 90, high: 70, medium: 50, low: 30, info: 10 };
  return Math.min(100, (base[severity] ?? 30) + Math.min(count - 1, 10));
}

export function analyzeCrawlResult(result: CrawlResult): { issues: SeoIssue[]; seoScore: number } {
  const issues: SeoIssue[] = [];
  const pages = result.pages.filter((p) => !p.error && p.statusCode >= 200 && p.statusCode < 400);
  if (pages.length === 0) return { issues, seoScore: 0 };

  // ─── Meta checks ──────────────────────────────────────────────────────────
  const missingTitles = pages.filter((p) => !p.title);
  if (missingTitles.length > 0) {
    issues.push({
      url: missingTitles[0].url,
      category: "meta",
      severity: "critical",
      title: `Missing title tag on ${missingTitles.length} page${missingTitles.length > 1 ? "s" : ""}`,
      description: `${missingTitles.length} page(s) have no <title> tag. The title tag is the single most important on-page SEO signal.`,
      recommendation: "Add a unique, descriptive title tag (50–60 characters) to every page.",
      priorityScore: priorityScore("critical", missingTitles.length),
      affectedElement: missingTitles.map((p) => p.url).join(", "),
    });
  }

  const shortTitles = pages.filter((p) => p.title && p.title.length < 30);
  if (shortTitles.length > 0) {
    issues.push({
      url: shortTitles[0].url,
      category: "meta",
      severity: "medium",
      title: `Title tag too short on ${shortTitles.length} page${shortTitles.length > 1 ? "s" : ""}`,
      description: "Short title tags (under 30 characters) miss keyword opportunities and may be less descriptive.",
      recommendation: "Expand titles to 50–60 characters, incorporating primary keywords naturally.",
      priorityScore: priorityScore("medium", shortTitles.length),
    });
  }

  const longTitles = pages.filter((p) => p.title && p.title.length > 65);
  if (longTitles.length > 0) {
    issues.push({
      url: longTitles[0].url,
      category: "meta",
      severity: "low",
      title: `Title tag too long on ${longTitles.length} page${longTitles.length > 1 ? "s" : ""}`,
      description: "Title tags over 65 characters are typically truncated in SERPs.",
      recommendation: "Trim titles to 50–60 characters while preserving primary keywords.",
      priorityScore: priorityScore("low", longTitles.length),
    });
  }

  // Duplicate titles
  const titleCounts = new Map<string, number>();
  for (const p of pages) {
    if (p.title) titleCounts.set(p.title, (titleCounts.get(p.title) ?? 0) + 1);
  }
  const dupTitles = [...titleCounts.entries()].filter(([, c]) => c > 1);
  if (dupTitles.length > 0) {
    const affectedPages = dupTitles.reduce((acc, [, c]) => acc + c, 0);
    issues.push({
      url: pages[0].url,
      category: "meta",
      severity: "high",
      title: `Duplicate title tags found (${dupTitles.length} unique title${dupTitles.length > 1 ? "s" : ""} shared across ${affectedPages} pages)`,
      description: "Duplicate titles confuse search engines about which page to rank and cause keyword cannibalization.",
      recommendation: "Ensure every page has a unique title that accurately reflects its specific content.",
      priorityScore: priorityScore("high", affectedPages),
    });
  }

  const missingMeta = pages.filter((p) => !p.metaDescription);
  if (missingMeta.length > 0) {
    issues.push({
      url: missingMeta[0].url,
      category: "meta",
      severity: missingMeta.length > pages.length / 2 ? "critical" : "high",
      title: `Missing meta description on ${missingMeta.length} page${missingMeta.length > 1 ? "s" : ""}`,
      description: "Meta descriptions are key to click-through rates from search results. Missing them reduces CTR significantly.",
      recommendation: "Write unique meta descriptions of 150–160 characters for each page, including the primary keyword.",
      priorityScore: priorityScore(missingMeta.length > pages.length / 2 ? "critical" : "high", missingMeta.length),
      affectedElement: missingMeta.slice(0, 5).map((p) => p.url).join(", "),
    });
  }

  const shortMeta = pages.filter((p) => p.metaDescription && p.metaDescription.length < 70);
  if (shortMeta.length > 0) {
    issues.push({
      url: shortMeta[0].url,
      category: "meta",
      severity: "low",
      title: `Meta description too short on ${shortMeta.length} page${shortMeta.length > 1 ? "s" : ""}`,
      description: "Short meta descriptions don't give users enough context to click from search results.",
      recommendation: "Expand meta descriptions to 150–160 characters with a clear value proposition.",
      priorityScore: priorityScore("low", shortMeta.length),
    });
  }

  const longMeta = pages.filter((p) => p.metaDescription && p.metaDescription.length > 165);
  if (longMeta.length > 0) {
    issues.push({
      url: longMeta[0].url,
      category: "meta",
      severity: "low",
      title: `Meta description too long on ${longMeta.length} page${longMeta.length > 1 ? "s" : ""}`,
      description: "Google typically truncates meta descriptions over 160 characters in SERPs.",
      recommendation: "Trim descriptions to 150–160 characters, keeping the key message early.",
      priorityScore: priorityScore("low", longMeta.length),
    });
  }

  // Missing OG tags
  const missingOg = pages.filter((p) => !p.ogTitle || !p.ogImage);
  if (missingOg.length > 0) {
    issues.push({
      url: missingOg[0].url,
      category: "meta",
      severity: "medium",
      title: `Open Graph tags missing on ${missingOg.length} page${missingOg.length > 1 ? "s" : ""}`,
      description: "Without og:title and og:image, social media shares show generic previews that reduce click-through.",
      recommendation: "Add og:title, og:description, og:image, and og:url to all pages. Use images at least 1200×630px.",
      priorityScore: priorityScore("medium", missingOg.length),
    });
  }

  // ─── Content checks ────────────────────────────────────────────────────────
  const missingH1 = pages.filter((p) => p.h1Tags.length === 0);
  if (missingH1.length > 0) {
    issues.push({
      url: missingH1[0].url,
      category: "content",
      severity: "critical",
      title: `Missing H1 tag on ${missingH1.length} page${missingH1.length > 1 ? "s" : ""}`,
      description: "The H1 is the most important content signal for search engines. Missing H1s leave critical context gaps.",
      recommendation: "Add exactly one H1 tag per page that clearly describes the page topic with the primary keyword.",
      priorityScore: priorityScore("critical", missingH1.length),
      affectedElement: missingH1.slice(0, 5).map((p) => p.url).join(", "),
    });
  }

  const multipleH1 = pages.filter((p) => p.h1Tags.length > 1);
  if (multipleH1.length > 0) {
    issues.push({
      url: multipleH1[0].url,
      category: "content",
      severity: "medium",
      title: `Multiple H1 tags on ${multipleH1.length} page${multipleH1.length > 1 ? "s" : ""}`,
      description: "Multiple H1s dilute the primary topic signal and can confuse search engine crawlers.",
      recommendation: "Use a single H1 per page. Use H2–H6 for sub-headings.",
      priorityScore: priorityScore("medium", multipleH1.length),
    });
  }

  const thinContent = pages.filter((p) => p.wordCount < 300 && p.wordCount > 0);
  if (thinContent.length > 0) {
    issues.push({
      url: thinContent[0].url,
      category: "content",
      severity: "high",
      title: `Thin content on ${thinContent.length} page${thinContent.length > 1 ? "s" : ""} (under 300 words)`,
      description: "Pages with fewer than 300 words are often considered low-quality by search engines and may be penalized.",
      recommendation: "Expand content to at least 500 words with relevant, helpful information that serves user intent.",
      priorityScore: priorityScore("high", thinContent.length),
    });
  }

  // ─── Image checks ─────────────────────────────────────────────────────────
  const allImgs = pages.flatMap((p) => p.imgAlts.map((i) => ({ ...i, pageUrl: p.url })));
  const missingAlts = allImgs.filter((i) => i.alt === null || i.alt === "");
  if (missingAlts.length > 0) {
    issues.push({
      url: missingAlts[0].pageUrl,
      category: "content",
      severity: missingAlts.length > 10 ? "high" : "medium",
      title: `${missingAlts.length} image${missingAlts.length > 1 ? "s" : ""} missing alt text`,
      description: "Images without alt text are invisible to search engines and fail WCAG accessibility requirements.",
      recommendation: "Add descriptive alt text to all meaningful images. Decorative images should use alt=\"\".",
      priorityScore: priorityScore(missingAlts.length > 10 ? "high" : "medium", missingAlts.length),
      affectedElement: missingAlts.slice(0, 3).map((i) => i.src).join(", "),
    });
  }

  // ─── Link checks ──────────────────────────────────────────────────────────
  const allLinks = pages.flatMap((p) => p.links.map((l) => ({ ...l, pageUrl: p.url })));
  const brokenLinks = allLinks.filter((l) => l.isBroken);
  if (brokenLinks.length > 0) {
    issues.push({
      url: brokenLinks[0].pageUrl,
      category: "links",
      severity: "high",
      title: `${brokenLinks.length} broken link${brokenLinks.length > 1 ? "s" : ""} detected`,
      description: "Broken links harm user experience, waste crawl budget, and signal poor site maintenance to search engines.",
      recommendation: "Fix or redirect all broken links. Audit link health quarterly.",
      priorityScore: priorityScore("high", brokenLinks.length),
    });
  }

  // No canonical
  const missingCanonical = pages.filter((p) => !p.canonicalUrl);
  if (missingCanonical.length > pages.length * 0.4) {
    issues.push({
      url: missingCanonical[0].url,
      category: "crawlability",
      severity: "medium",
      title: `Missing canonical tags on ${missingCanonical.length} page${missingCanonical.length > 1 ? "s" : ""}`,
      description: "Without canonical tags, search engines may index duplicate or near-duplicate pages, splitting link equity.",
      recommendation: "Add a self-referencing canonical tag to every page: <link rel=\"canonical\" href=\"{url}\">.",
      priorityScore: priorityScore("medium", missingCanonical.length),
    });
  }

  // ─── Mobile checks ────────────────────────────────────────────────────────
  const missingViewport = pages.filter((p) => !p.hasViewport);
  if (missingViewport.length > 0) {
    issues.push({
      url: missingViewport[0].url,
      category: "mobile",
      severity: "critical",
      title: `Missing viewport meta tag on ${missingViewport.length} page${missingViewport.length > 1 ? "s" : ""}`,
      description: "Without a viewport tag, mobile browsers render the page at desktop width, causing tiny text and requiring pinch-to-zoom.",
      recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to all pages.',
      priorityScore: priorityScore("critical", missingViewport.length),
    });
  }

  // ─── Security checks ──────────────────────────────────────────────────────
  const httpPages = pages.filter((p) => !p.hasHttps);
  if (httpPages.length > 0) {
    issues.push({
      url: httpPages[0].url,
      category: "security",
      severity: "critical",
      title: `${httpPages.length} page${httpPages.length > 1 ? "s" : ""} served over HTTP (not HTTPS)`,
      description: "HTTP pages are marked 'Not Secure' by browsers. HTTPS is a confirmed Google ranking signal.",
      recommendation: "Migrate all pages to HTTPS. Redirect all HTTP traffic to HTTPS permanently (301).",
      priorityScore: priorityScore("critical", httpPages.length),
    });
  }

  // ─── Performance checks ───────────────────────────────────────────────────
  const slowPages = pages.filter((p) => p.loadTimeMs > 3000);
  if (slowPages.length > 0) {
    issues.push({
      url: slowPages[0].url,
      category: "performance",
      severity: slowPages.length > pages.length / 2 ? "critical" : "high",
      title: `${slowPages.length} page${slowPages.length > 1 ? "s" : ""} load in over 3 seconds`,
      description: `Slow pages hurt Core Web Vitals scores. Average load time: ${Math.round(slowPages.reduce((a, p) => a + p.loadTimeMs, 0) / slowPages.length)}ms.`,
      recommendation: "Optimize images (WebP/AVIF), enable compression, minimize render-blocking resources, and use a CDN.",
      priorityScore: priorityScore(slowPages.length > pages.length / 2 ? "critical" : "high", slowPages.length),
    });
  }

  const verySlowPages = pages.filter((p) => p.loadTimeMs > 6000);
  if (verySlowPages.length > 0) {
    issues.push({
      url: verySlowPages[0].url,
      category: "performance",
      severity: "critical",
      title: `${verySlowPages.length} page${verySlowPages.length > 1 ? "s" : ""} critically slow (over 6 seconds)`,
      description: "Pages taking over 6 seconds to load have extremely high bounce rates and poor Core Web Vitals.",
      recommendation: "Immediately investigate server response time, large assets, and unoptimized JavaScript. Consider server-side rendering or static generation.",
      priorityScore: 95,
    });
  }

  // ─── Structured data checks ───────────────────────────────────────────────
  const noStructuredData = pages.filter((p) => p.structuredData.length === 0);
  if (noStructuredData.length > pages.length * 0.5) {
    issues.push({
      url: noStructuredData[0].url,
      category: "structured_data",
      severity: "medium",
      title: `No structured data (schema.org) on ${noStructuredData.length} page${noStructuredData.length > 1 ? "s" : ""}`,
      description: "Structured data enables rich results in SERPs (stars, FAQs, breadcrumbs) which significantly improve CTR.",
      recommendation: "Implement relevant schema.org markup: Organization, WebPage, Article, Product, FAQPage, or LocalBusiness as appropriate.",
      priorityScore: priorityScore("medium", noStructuredData.length),
    });
  }

  // ─── Crawlability checks ──────────────────────────────────────────────────
  if (result.blockedByRobots.length > 0) {
    issues.push({
      url: result.blockedByRobots[0],
      category: "crawlability",
      severity: "medium",
      title: `${result.blockedByRobots.length} URL${result.blockedByRobots.length > 1 ? "s" : ""} blocked by robots.txt`,
      description: "Some pages are blocked from crawlers by robots.txt. Verify this is intentional.",
      recommendation: "Review robots.txt to ensure important pages aren't accidentally blocked from indexing.",
      priorityScore: priorityScore("medium", result.blockedByRobots.length),
    });
  }

  const errorPages = result.pages.filter((p) => p.error || p.statusCode >= 400);
  if (errorPages.length > 0) {
    issues.push({
      url: errorPages[0].url,
      category: "crawlability",
      severity: "high",
      title: `${errorPages.length} page${errorPages.length > 1 ? "s" : ""} returned errors (4xx/5xx or unreachable)`,
      description: "Error pages waste crawl budget and create dead ends for users and search engines.",
      recommendation: "Fix server errors, set up proper 301 redirects for moved content, and implement custom 404 pages.",
      priorityScore: priorityScore("high", errorPages.length),
    });
  }

  // ─── SEO score calculation ────────────────────────────────────────────────
  const deductions: Record<string, number> = {
    critical: 15,
    high: 8,
    medium: 4,
    low: 1,
  };

  let score = 100;
  for (const issue of issues) {
    score -= deductions[issue.severity] ?? 1;
  }
  const seoScore = Math.max(5, Math.min(100, Math.round(score)));

  return { issues, seoScore };
}
