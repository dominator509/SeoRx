# GEO/AEO Implementation Notes

Last updated: 2026-06-23

## Phase 0 repo patterns found

- SEORx is a pnpm monorepo, not a Next.js/Prisma app.
- The API server is Express in `artifacts/api-server`.
- The product UI is React/Vite in `artifacts/seorx`.
- Database ownership is Drizzle in `lib/db/src/schema`, with migrations in `lib/db/migrations`.
- API contracts are owned by `lib/api-spec/openapi.yaml`; generated clients live in `lib/api-client-react` and `lib/api-zod`.
- Current audit execution is in `artifacts/api-server/src/routes/audits.ts`.
- Current crawler extraction is in `artifacts/api-server/src/lib/crawler.ts`.
- Current SEO issue generation is centralized in `artifacts/api-server/src/lib/seo-analyzer.ts`.
- Current AI provider selection and calls are in `artifacts/api-server/src/lib/ai-adapter.ts`.
- Current approval workflow is issue-level: `audit_issues.status` moves through `open`, `approved`, `dismissed`, and `fixed`.
- Current report creation and download are in `artifacts/api-server/src/routes/reports.ts`.
- Current PDF rendering is in `artifacts/api-server/src/lib/pdf-report.ts`.
- There is no Markdown export adapter yet.
- There is no dedicated client dashboard route separate from the authenticated product app.

## Phase 1 files extended

- `.env.example`
- `scripts/src/env-check.ts`
- `lib/db/src/schema/audits.ts`
- `lib/db/src/schema/reports.ts`
- `lib/db/src/schema/geo-aeo.ts`
- `lib/db/src/schema/index.ts`
- `artifacts/api-server/src/lib/geo-aeo/constants.ts`
- `lib/db/migrations/*_add_geo_aeo_foundation.sql`

## Phase 2 domain service files added

- `artifacts/api-server/src/lib/geo-aeo/observations.ts`
- `artifacts/api-server/src/lib/geo-aeo/packages.ts`
- `artifacts/api-server/src/lib/geo-aeo/prompt-set.ts`
- `artifacts/api-server/src/lib/geo-aeo/schemas.ts`
- `artifacts/api-server/src/lib/geo-aeo/scoring.ts`
- `artifacts/api-server/src/test/geo-aeo.unit.test.ts`

## Phase 3 scanner/API files added

- `artifacts/api-server/src/lib/geo-aeo/scanners.ts`
- `artifacts/api-server/src/test/geo-aeo-scanners.unit.test.ts`
- `artifacts/api-server/src/routes/geo-aeo.ts`
- `artifacts/api-server/src/routes/index.ts`
- `artifacts/api-server/src/test/api.integration.test.ts`
- `lib/api-spec/openapi.yaml`
- `lib/api-client-react/src/generated/*`
- `lib/api-zod/src/generated/*`

## GEO/AEO route behavior

- All `/api/audits/:id/geo/*` routes require authentication and existing audit access.
- Routes return `404` while `GEO_AEO_ENABLED` is not `true`.
- Profile, generated prompts, manual observations, draft recommendations, approval-to-audit-issue metadata, and score snapshots now persist through Drizzle.
- Recommendation approval creates a normal `audit_issues` row with GEO/AEO issue metadata while preserving the existing issue approval workflow.
- Live AI-search platform checks remain disabled; observation capture is manual or deterministic until a compliant external adapter is added.

## Phase 1 schema approach

- Added `audit_type` with existing audits defaulting to `seo`.
- Added `report_type` with existing reports defaulting to `seo_audit`.
- Added `ai_visibility_score` to audits for the latest score summary.
- Added nullable issue metadata fields to `audit_issues` rather than changing existing issue behavior.
- Added GEO/AEO-specific Drizzle tables for profiles, prompts, manual observations, page assessments, recommendations, and score snapshots.
- Added indexes on audit, prompt, surface, page URL, and status lookup fields.

## Feature flags

- `GEO_AEO_ENABLED=false`
- `GEO_AEO_REAL_PLATFORM_CHECKS=false`
- `GEO_AEO_MANUAL_OBSERVATIONS=true`
- `GEO_AEO_DEFAULT_PROMPT_COUNT=25`
- `GEO_AEO_MAX_COMPETITORS=5`
- `GEO_AEO_MAX_PAGES_BASIC=5`
- `GEO_AEO_MAX_PAGES_STANDARD=10`
- `GEO_AEO_MAX_PAGES_PREMIUM=25`

## Test and build commands

- `rtk corepack pnpm --filter @workspace/db run check`
- `rtk corepack pnpm --filter @workspace/scripts run env:check -- .env.example`
- `rtk corepack pnpm --filter @workspace/api-server run typecheck`
- `rtk corepack pnpm --filter @workspace/seorx run typecheck`
- `rtk corepack pnpm --filter @workspace/api-server run test`
- `rtk corepack pnpm test`
- `rtk corepack pnpm run build`
- `rtk git diff --check`

There is no root lint script today.

## Assumptions

- GEO/AEO should use Drizzle migrations, not Prisma.
- GEO/AEO client-facing data remains hidden until explicit approval paths are implemented.
- Live AI-search platform checks remain disabled and unimplemented unless a compliant adapter is added later.
- Markdown export should be added before extending PDF behavior if the current PDF path becomes a blocker.
