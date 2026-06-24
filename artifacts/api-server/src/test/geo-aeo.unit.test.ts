import { describe, expect, it } from "vitest";
import {
  assertGeoPackageLimits,
  calculateGeoAeoScore,
  generateGeoPromptSet,
  geoAuditProfileInputSchema,
  getGeoPackageLimits,
  gradeForScore,
  normalizeGeoObservation,
} from "../lib/geo-aeo";

const baseProfile = {
  businessName: "Austin Pipe Pros",
  websiteUrl: "https://austinpipe.example",
  primaryOffer: "emergency plumbing",
  targetServices: ["water heater repair", "burst pipe repair"],
  targetLocations: ["Austin, TX"],
  targetCustomers: ["homeowners"],
  competitors: [{ name: "Rapid Rooter", url: "https://rapid.example" }],
  proofPoints: ["licensed", "24/7 service"],
  customerQuestions: ["Do you offer same-day emergency plumbing"],
  packageTier: "standard" as const,
};

describe("GEO/AEO domain services", () => {
  it("returns Fiverr package limits and rejects over-limit inputs", () => {
    expect(getGeoPackageLimits("basic")).toMatchObject({
      maxPages: 5,
      maxPrompts: 10,
      maxCompetitors: 2,
    });
    expect(getGeoPackageLimits("standard")).toMatchObject({
      maxPages: 10,
      maxPrompts: 25,
      maxCompetitors: 3,
    });
    expect(getGeoPackageLimits("premium")).toMatchObject({
      maxPages: 25,
      maxPrompts: 50,
      maxCompetitors: 5,
    });

    expect(() => assertGeoPackageLimits({ tier: "basic", pageCount: 6 })).toThrow("pages");
    expect(() => assertGeoPackageLimits({ tier: "standard", promptCount: 25 })).not.toThrow();
  });

  it("validates profile intake without requiring optional arrays", () => {
    const profile = geoAuditProfileInputSchema.parse({
      businessName: "Example Dental",
      websiteUrl: "https://dental.example",
    });

    expect(profile.packageTier).toBe("standard");
    expect(profile.targetLocations).toEqual([]);
    expect(profile.competitors).toEqual([]);
  });

  it("generates deterministic prompt sets inside package limits", () => {
    const prompts = generateGeoPromptSet({ profile: baseProfile });

    expect(prompts).toHaveLength(19);
    expect(prompts[0]).toMatchObject({
      intent: "best_provider",
      targetLocation: "Austin, TX",
      priority: 95,
    });
    expect(prompts.map((prompt) => prompt.promptText)).toContain(
      "Compare Austin Pipe Pros vs Rapid Rooter for water heater repair.",
    );
    expect(new Set(prompts.map((prompt) => prompt.promptText)).size).toBe(prompts.length);
  });

  it("handles missing location and explicit max prompt cap", () => {
    const prompts = generateGeoPromptSet({
      profile: {
        businessName: "Sourceable Studio",
        websiteUrl: "https://studio.example",
        primaryOffer: "content strategy",
        packageTier: "basic",
      },
      maxPrompts: 3,
    });

    expect(prompts).toHaveLength(3);
    expect(prompts[0]?.promptText).toContain("your area");
  });

  it("normalizes manual observation snapshots", () => {
    const observation = normalizeGeoObservation({
      surface: "chatgpt",
      brandMentioned: true,
      brandCited: false,
      answerSummary: "  Mentioned   the business without citing it.  ",
      citedUrls: ["https://source.example", "https://source.example"],
      competitorsMentioned: ["Competitor", "Competitor"],
      confidenceScore: 70,
    });

    expect(observation.answerSummary).toBe("Mentioned the business without citing it.");
    expect(observation.citedUrls).toEqual(["https://source.example"]);
    expect(observation.competitorsMentioned).toEqual(["Competitor"]);
  });

  it("calculates bounded weighted AI visibility scores and grades", () => {
    const score = calculateGeoAeoScore({
      profile: baseProfile,
      pageAssessments: [
        {
          aiCitableScore: 80,
          answerCoverageScore: 70,
          entityClarityScore: 85,
          proofSignalScore: 60,
          structureScore: 75,
          schemaReadinessScore: 55,
          citationReadinessScore: 50,
          crawlabilityScore: 90,
        },
      ],
      observations: [
        { brandMentioned: true, brandCited: false, competitorsMentioned: ["Rapid Rooter"] },
        { brandMentioned: false, brandCited: false, competitorsMentioned: ["Rapid Rooter"] },
      ],
      recommendations: [
        {
          issueType: "MISSING_SCHEMA_FOR_AI_CONTEXT",
          priorityScore: 82,
          title: "Missing FAQ schema",
        },
      ],
    });

    expect(score.aiVisibilityScore).toBeGreaterThanOrEqual(0);
    expect(score.aiVisibilityScore).toBeLessThanOrEqual(100);
    expect(score.grade).toBe("Needs Work");
    expect(score.subScores.schemaReadiness).toBe(55);
    expect(score.topRisks).toContain("Missing FAQ schema");
    expect(score.quickWins.some((item) => item.includes("schema"))).toBe(true);
  });

  it("maps score grades deterministically", () => {
    expect(gradeForScore(95)).toBe("Excellent");
    expect(gradeForScore(80)).toBe("Strong");
    expect(gradeForScore(65)).toBe("Needs Work");
    expect(gradeForScore(45)).toBe("Weak");
    expect(gradeForScore(10)).toBe("Critical");
  });
});
