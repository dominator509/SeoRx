import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret, generateApiKey, hashApiKey } from "../lib/crypto";
import { fetchRealPageSpeed, syntheticPageSpeed } from "../lib/pagespeed";
import { logger } from "../lib/logger";
import { analyzeCrawlResult } from "../lib/seo-analyzer";
import type { CrawlResult, CrawledPage } from "../lib/crawler";

describe("core deterministic utilities", () => {
  const originalEncryptionKey = process.env.ENCRYPTION_KEY;
  const originalPageSpeedKey = process.env.PAGESPEED_API_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalEncryptionKey === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = originalEncryptionKey;

    if (originalPageSpeedKey === undefined) delete process.env.PAGESPEED_API_KEY;
    else process.env.PAGESPEED_API_KEY = originalPageSpeedKey;
  });

  describe("crypto secret handling", () => {
    it("encrypts and decrypts secrets with AES-GCM when ENCRYPTION_KEY is set", () => {
      process.env.ENCRYPTION_KEY = "deterministic-test-encryption-key";
      const plaintext = "super-secret-value";

      const encrypted = encryptSecret(plaintext);
      expect(encrypted.startsWith("gcm:")).toBe(true);
      expect(decryptSecret(encrypted)).toBe(plaintext);
    });

    it("falls back to b64 format when ENCRYPTION_KEY is missing", () => {
      delete process.env.ENCRYPTION_KEY;
      const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => logger);

      const encrypted = encryptSecret("fallback-secret");
      expect(encrypted.startsWith("b64:")).toBe(true);
      expect(decryptSecret(encrypted)).toBe("fallback-secret");
      expect(warnSpy).toHaveBeenCalled();
    });

    it("decrypts legacy plain base64 payloads", () => {
      const legacy = Buffer.from("legacy-plaintext").toString("base64");
      expect(decryptSecret(legacy)).toBe("legacy-plaintext");
    });

    it("returns null when decrypting GCM payload without ENCRYPTION_KEY", () => {
      process.env.ENCRYPTION_KEY = "present-key";
      const encrypted = encryptSecret("requires-key");
      delete process.env.ENCRYPTION_KEY;
      const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => logger);

      expect(decryptSecret(encrypted)).toBeNull();
      expect(errorSpy).toHaveBeenCalled();
    });

    it("returns null for malformed encrypted payloads", () => {
      process.env.ENCRYPTION_KEY = "another-key";
      const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => logger);

      expect(decryptSecret("gcm:not-valid-base64@@")).toBeNull();
      expect(errorSpy).toHaveBeenCalled();
    });

    it("generates prefixed API keys and deterministic hashes", () => {
      const generated = generateApiKey();
      expect(generated.key.startsWith("srx_")).toBe(true);
      expect(generated.prefix).toBe(generated.key.slice(0, 12));
      expect(generated.hash).toBe(hashApiKey(generated.key));
      expect(hashApiKey("abc")).toHaveLength(64);
    });
  });

  describe("pagespeed parsing and fallback", () => {
    it("returns null when PAGESPEED_API_KEY is missing", async () => {
      delete process.env.PAGESPEED_API_KEY;
      expect(await fetchRealPageSpeed("https://example.com", "mobile")).toBeNull();
    });

    it("returns null and warns on non-200 response", async () => {
      process.env.PAGESPEED_API_KEY = "pagespeed-key";
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("rate limited", { status: 429 }));
      const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => logger);

      expect(await fetchRealPageSpeed("https://example.com", "mobile")).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
    });

    it("parses live PageSpeed payload into normalized metrics", async () => {
      process.env.PAGESPEED_API_KEY = "pagespeed-key";
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            lighthouseResult: {
              categories: {
                performance: { score: 0.91 },
                accessibility: { score: 0.77 },
                "best-practices": { score: 0.88 },
                seo: { score: 0.95 },
              },
              audits: {
                "first-contentful-paint": { numericValue: 1300 },
                "largest-contentful-paint": { numericValue: 2600 },
                "cumulative-layout-shift": { numericValue: 0.04 },
                "total-blocking-time": { numericValue: 210 },
                "speed-index": { numericValue: 1700 },
              },
            },
            loadingExperience: {
              metrics: {
                FIRST_CONTENTFUL_PAINT_MS: { percentile: 1400 },
                LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2800 },
                FIRST_INPUT_DELAY_MS: { percentile: 42 },
                CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 9 },
                EXPERIMENTAL_TIME_TO_FIRST_BYTE: { percentile: 350 },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      const result = await fetchRealPageSpeed("https://example.com", "desktop");
      expect(result).toMatchObject({
        performanceScore: 91,
        accessibilityScore: 77,
        bestPracticesScore: 88,
        seoScore: 95,
        lcp: 2.8,
        fid: 42,
        cls: 0.09,
        fcp: 1.4,
        ttfb: 0.35,
        speedIndex: 1.7,
        totalBlockingTime: 210,
        tbt: 210,
      });
    });

    it("returns null when fetch throws", async () => {
      process.env.PAGESPEED_API_KEY = "pagespeed-key";
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
      const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => logger);

      expect(await fetchRealPageSpeed("https://example.com", "mobile")).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
    });

    it("generates synthetic metrics within expected bounds for both devices", () => {
      const mobile = syntheticPageSpeed("mobile");
      const desktop = syntheticPageSpeed("desktop");

      for (const metrics of [mobile, desktop]) {
        expect(metrics.performanceScore).toBeGreaterThanOrEqual(0);
        expect(metrics.performanceScore).toBeLessThanOrEqual(100);
        expect(metrics.accessibilityScore).toBeGreaterThanOrEqual(65);
        expect(metrics.accessibilityScore).toBeLessThanOrEqual(95);
        expect(metrics.bestPracticesScore).toBeGreaterThanOrEqual(60);
        expect(metrics.bestPracticesScore).toBeLessThanOrEqual(95);
        expect(metrics.seoScore).toBeGreaterThanOrEqual(55);
        expect(metrics.seoScore).toBeLessThanOrEqual(95);
        expect(metrics.lcp).not.toBeNull();
        expect(metrics.fcp).not.toBeNull();
        expect(metrics.ttfb).not.toBeNull();
        expect(metrics.tbt).not.toBeNull();
      }
    });
  });

  describe("whitebox data flow and state tracking", () => {
    function makePage(overrides: Partial<CrawledPage> = {}): CrawledPage {
      return {
        url: "https://example.com/",
        statusCode: 200,
        h1Tags: ["Heading"],
        h2Tags: ["Subhead"],
        imgAlts: [{ src: "/hero.jpg", alt: "Hero image" }],
        links: [{ href: "https://example.com/about", text: "About", isInternal: true, isBroken: false }],
        structuredData: ["{\"@type\":\"WebPage\"}"],
        wordCount: 600,
        loadTimeMs: 1200,
        hasHttps: true,
        hasViewport: true,
        html: "<html><body>ok</body></html>",
        title: "A reasonably sized SEO title",
        metaDescription: "A complete and useful meta description for search snippets.",
        canonicalUrl: "https://example.com/",
        ogTitle: "OG title",
        ogImage: "https://example.com/og.png",
        ...overrides,
      };
    }

    it("tracks intermediate issue aggregation and enforces minimum score floor for extreme degraded crawls", () => {
      const degradedPages: CrawledPage[] = [
        makePage({
          url: "http://example.com/a",
          title: "",
          metaDescription: "",
          h1Tags: [],
          imgAlts: [{ src: "/a.jpg", alt: "" }],
          links: [{ href: "https://example.com/missing", text: "Missing", isInternal: true, isBroken: true }],
          structuredData: [],
          wordCount: 120,
          loadTimeMs: 7500,
          hasHttps: false,
          hasViewport: false,
        }),
        makePage({
          url: "http://example.com/b",
          title: "",
          metaDescription: "",
          h1Tags: [],
          imgAlts: [{ src: "/b.jpg", alt: null }],
          links: [{ href: "https://example.com/missing2", text: "Missing2", isInternal: true, isBroken: true }],
          structuredData: [],
          wordCount: 0,
          loadTimeMs: 8200,
          hasHttps: false,
          hasViewport: false,
          statusCode: 503,
          error: "timeout",
        }),
      ];

      const result: CrawlResult = {
        pages: degradedPages,
        crawledUrls: new Set(degradedPages.map((p) => p.url)),
        blockedByRobots: ["https://example.com/private"],
        errors: ["http://example.com/b: timeout"],
        durationMs: 2000,
      };

      const analysis = analyzeCrawlResult(result);
      const titles = analysis.issues.map((i) => i.title);
      expect(titles).toContain("Missing title tag on 1 page");
      expect(titles).toContain("Missing H1 tag on 1 page");
      expect(titles.some((t) => t.includes("returned errors"))).toBe(true);
      expect(titles.some((t) => t.includes("blocked by robots.txt"))).toBe(true);
      expect(analysis.seoScore).toBe(5);
    });

    it("applies deterministic device-specific metric transformations from shared random stream", () => {
      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

      const mobile = syntheticPageSpeed("mobile");
      const desktop = syntheticPageSpeed("desktop");

      expect(randomSpy).toHaveBeenCalled();
      expect(desktop.lcp).toBeLessThan(mobile.lcp!);
      expect(desktop.fcp).toBeLessThan(mobile.fcp!);
      expect(desktop.ttfb).toBeLessThan(mobile.ttfb!);
      expect(desktop.tbt).toBeLessThan(mobile.tbt!);
      expect(desktop.fid).toBeLessThan(mobile.fid!);
      expect(desktop.performanceScore).toBeGreaterThanOrEqual(mobile.performanceScore);
    });
  });
});
