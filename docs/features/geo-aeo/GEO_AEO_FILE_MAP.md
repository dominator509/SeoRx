# GEO/AEO Suggested File Map

Adapt these paths to the actual repository. Do not create duplicate systems if equivalent files already exist.

## Shared types/constants

```txt
lib/shared/issue-types.ts
lib/shared/issue-categories.ts
lib/shared/report-types.ts
lib/shared/audit-types.ts
lib/shared/feature-flags.ts
lib/shared/geo-aeo.ts
types/geo-aeo.ts
```

## Database

```txt
prisma/schema.prisma
prisma/migrations/<timestamp>_add_geo_aeo_audit/
prisma/seed.ts
```

## Validation schemas

```txt
lib/shared/schemas/geo-aeo.ts
server/validation/geo-aeo.schema.ts
```

## Services

```txt
server/services/geo-aeo-audit.service.ts
server/services/geo-profile.service.ts
server/services/geo-prompt-set.service.ts
server/services/geo-observation.service.ts
server/services/geo-page-assessment.service.ts
server/services/geo-scoring.service.ts
server/services/geo-recommendation.service.ts
server/services/geo-report.service.ts
server/services/geo-fiverr-package.service.ts
```

## Scanners

```txt
server/scanners/geo/ai-answer-coverage.scanner.ts
server/scanners/geo/entity-clarity.scanner.ts
server/scanners/geo/ai-citable-content.scanner.ts
server/scanners/geo/sourceable-claims.scanner.ts
server/scanners/geo/geo-schema-readiness.scanner.ts
server/scanners/geo/competitor-answer-gap.scanner.ts
server/scanners/geo/citation-readiness.scanner.ts
server/scanners/geo/ai-crawlability.scanner.ts
server/scanners/geo/service-page-gap.scanner.ts
server/scanners/geo/geo-scoring.scanner.ts
server/scanners/registry.ts
```

## AI prompts/output schemas

```txt
server/prompts/geo/generate-prompt-set.prompt.ts
server/prompts/geo/assess-page-citability.prompt.ts
server/prompts/geo/generate-geo-recommendations.prompt.ts
server/prompts/geo/generate-geo-report-summary.prompt.ts
server/prompts/geo/generate-30-day-plan.prompt.ts
server/prompts/geo/generate-fiverr-delivery-message.prompt.ts
server/prompts/geo/output-schemas.ts
```

## Report/export

```txt
server/reports/templates/geo-aeo-report.template.ts
server/reports/builders/geo-aeo-report.builder.ts
server/services/report.service.ts
server/adapters/exports/markdown-export.adapter.ts
server/adapters/exports/pdf-export.adapter.ts
```

## API routes or server actions

```txt
app/api/audits/[auditId]/geo/profile/route.ts
app/api/audits/[auditId]/geo/prompts/generate/route.ts
app/api/audits/[auditId]/geo/scan/route.ts
app/api/audits/[auditId]/geo/observations/route.ts
app/api/audits/[auditId]/geo/score/route.ts
app/api/audits/[auditId]/geo/recommendations/generate/route.ts
app/api/reports/[auditId]/generate/route.ts
app/api/exports/[reportId]/pdf/route.ts
```

If the repo uses server actions instead of API routes, use the existing server action convention.

## Admin UI

```txt
app/admin/audits/[auditId]/geo/page.tsx
app/admin/audits/[auditId]/geo/profile/page.tsx
app/admin/audits/[auditId]/geo/prompts/page.tsx
app/admin/audits/[auditId]/geo/observations/page.tsx
app/admin/audits/[auditId]/geo/competitors/page.tsx
app/admin/audits/[auditId]/geo/report/page.tsx
components/admin/geo-aeo/GeoAeoOverview.tsx
components/admin/geo-aeo/GeoAeoProfileForm.tsx
components/admin/geo-aeo/GeoPromptTable.tsx
components/admin/geo-aeo/GeoObservationForm.tsx
components/admin/geo-aeo/GeoVisibilityScoreCard.tsx
components/admin/geo-aeo/GeoRecommendationReview.tsx
components/admin/geo-aeo/GeoFiverrFulfillmentChecklist.tsx
```

## Client UI

```txt
app/client/ai-visibility/page.tsx
components/client/geo-aeo/ClientAiVisibilitySummary.tsx
```

Only add if license/access patterns are clear.

## Tests

```txt
tests/unit/geo-aeo/geo-prompt-set.test.ts
tests/unit/geo-aeo/geo-scoring.test.ts
tests/unit/geo-aeo/geo-fiverr-package.test.ts
tests/unit/scanners/geo/entity-clarity.scanner.test.ts
tests/unit/scanners/geo/ai-answer-coverage.scanner.test.ts
tests/unit/scanners/geo/ai-citable-content.scanner.test.ts
tests/unit/scanners/geo/sourceable-claims.scanner.test.ts
tests/unit/scanners/geo/geo-schema-readiness.scanner.test.ts
tests/integration/geo-aeo/geo-profile.integration.test.ts
tests/integration/geo-aeo/geo-observations.integration.test.ts
tests/integration/geo-aeo/geo-report.integration.test.ts
tests/security/geo-aeo-access.security.test.ts
tests/fixtures/geo-aeo/*.html
```

## Docs

```txt
docs/geo-aeo/IMPLEMENTATION_NOTES.md
docs/geo-aeo/GEO_AEO_FEATURE_SPEC.md
docs/geo-aeo/GEO_AEO_BUILD_ROADMAP.md
docs/geo-aeo/GEO_AEO_REPORT_TEMPLATE.md
docs/geo-aeo/GEO_AEO_ACCEPTANCE_CRITERIA_AND_TEST_PLAN.md
```
