import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret, generateApiKey, hashApiKey } from "../lib/crypto";
import { fetchRealPageSpeed, syntheticPageSpeed } from "../lib/pagespeed";
import { logger } from "../lib/logger";

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
});
