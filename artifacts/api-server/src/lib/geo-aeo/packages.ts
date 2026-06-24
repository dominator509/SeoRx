import { GEO_AEO_FEATURE_FLAGS, GEO_AEO_FIVERR_PACKAGES } from "./constants";
import type { GeoPackageTier } from "./schemas";

export interface GeoPackageLimits {
  tier: GeoPackageTier;
  maxPages: number;
  maxPrompts: number;
  maxCompetitors: number;
  reportSections: string[];
}

const CUSTOM_LIMITS: GeoPackageLimits = {
  tier: "custom",
  maxPages: GEO_AEO_FEATURE_FLAGS.maxPagesPremium,
  maxPrompts: 50,
  maxCompetitors: GEO_AEO_FEATURE_FLAGS.maxCompetitors,
  reportSections: [
    "AI visibility score",
    "Prompt set",
    "Manual observations",
    "Page assessments",
    "Recommendations",
    "30-day plan",
  ],
};

export function getGeoPackageLimits(tier: GeoPackageTier): GeoPackageLimits {
  if (tier === "custom") return CUSTOM_LIMITS;
  const preset = GEO_AEO_FIVERR_PACKAGES[tier];
  return {
    tier,
    maxPages: preset.pages,
    maxPrompts: preset.prompts,
    maxCompetitors: preset.competitors,
    reportSections: [...preset.includes],
  };
}

export function assertGeoPackageLimits(input: {
  tier: GeoPackageTier;
  pageCount?: number;
  promptCount?: number;
  competitorCount?: number;
}): void {
  const limits = getGeoPackageLimits(input.tier);
  assertLimit("pages", input.pageCount, limits.maxPages);
  assertLimit("prompts", input.promptCount, limits.maxPrompts);
  assertLimit("competitors", input.competitorCount, limits.maxCompetitors);
}

function assertLimit(name: string, actual: number | undefined, maximum: number): void {
  if (actual == null) return;
  if (actual > maximum) {
    throw new Error(`GEO/AEO package limit exceeded for ${name}: ${actual} > ${maximum}`);
  }
}
