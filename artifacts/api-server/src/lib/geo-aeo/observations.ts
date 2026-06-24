import {
  geoVisibilityObservationInputSchema,
  type GeoVisibilityObservationInput,
} from "./schemas";

export function normalizeGeoObservation(input: unknown): GeoVisibilityObservationInput {
  const parsed = geoVisibilityObservationInputSchema.parse(input);
  return {
    ...parsed,
    answerSummary: normalizeOptionalText(parsed.answerSummary),
    rawAnswerExcerpt: normalizeOptionalText(parsed.rawAnswerExcerpt),
    notes: normalizeOptionalText(parsed.notes),
    citedUrls: unique(parsed.citedUrls),
    competitorsMentioned: unique(parsed.competitorsMentioned),
  };
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed || undefined;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
