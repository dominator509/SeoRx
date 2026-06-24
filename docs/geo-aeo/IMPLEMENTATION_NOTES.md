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
- Markdown export is implemented for `geo_aeo_audit` reports; existing SEO PDF behavior remains separate.
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

## Phase 4 AI-assisted draft files added

- `artifacts/api-server/src/lib/geo-aeo/ai-drafts.ts`
- `artifacts/api-server/src/lib/ai-adapter.ts`
- `artifacts/api-server/src/routes/geo-aeo.ts`
- `artifacts/api-server/src/test/geo-aeo.unit.test.ts`
- `artifacts/api-server/src/test/api.integration.test.ts`
- `lib/api-spec/openapi.yaml`
- `lib/api-client-react/src/generated/*`
- `lib/api-zod/src/generated/*`

## Phase 5 report/export files added

- `artifacts/api-server/src/lib/geo-aeo/report.ts`
- `artifacts/api-server/src/routes/reports.ts`
- `lib/db/src/schema/reports.ts`
- `lib/db/migrations/*_add_markdown_report_format.sql`
- `lib/api-spec/openapi.yaml`
- `lib/api-client-react/src/generated/*`
- `lib/api-zod/src/generated/*`

## Phase 7 admin UI files added

- `artifacts/api-server/src/routes/geo-aeo.ts`
- `artifacts/seorx/src/pages/audit-new.tsx`
- `artifacts/seorx/src/pages/audits.tsx`
- `artifacts/seorx/src/pages/audit-detail.tsx`
- `artifacts/seorx/src/pages/reports.tsx`
- `lib/api-spec/openapi.yaml`
- `lib/api-client-react/src/generated/*`
- `lib/api-zod/src/generated/*`

## GEO/AEO route behavior

- All `/api/audits/:id/geo/*` routes require authentication and existing audit access.
- Routes return `404` while `GEO_AEO_ENABLED` is not `true`.
- Profile, generated prompts, manual observations, draft recommendations, approval-to-audit-issue metadata, and score snapshots now persist through Drizzle.
- Recommendation approval creates a normal `audit_issues` row with GEO/AEO issue metadata while preserving the existing issue approval workflow.
- Live AI-search platform checks remain disabled; observation capture is manual or deterministic until a compliant external adapter is added.

## GEO/AEO audit execution behavior

- `POST /api/audits` now persists `auditType`.
- `geo_aeo` audits skip ordinary SEO issue insertion and persist deterministic GEO/AEO scanner findings instead.
- `hybrid` audits retain ordinary SEO issues and also persist deterministic GEO/AEO scanner findings.
- GEO/AEO audit execution writes page assessments, draft recommendations, audit issue metadata, and a score snapshot when `GEO_AEO_ENABLED=true`.
- Test mode raises the audit route rate-limit ceiling so integration polling does not mask runtime behavior; production remains capped at 20 audit-route requests per hour.

## GEO/AEO report/export behavior

- `POST /api/reports` defaults `geo_aeo` audits to `reportType=geo_aeo_audit` and `format=markdown`.
- `geo_aeo_audit` reports use a deterministic canonical payload built from the audit, client, profile, prompts, approved observations, page assessments, approved recommendations, approved issues, and latest score snapshot.
- `GET /api/reports/:id/download` returns `text/markdown` and a `.md` attachment for GEO/AEO reports.
- GEO/AEO report generation rejects unsupported export formats instead of producing a misleading SEO PDF.
- The Markdown export includes the required AI answer variability disclaimer and avoids live AI-platform checks.
- Draft and hidden GEO/AEO recommendations are excluded from canonical report export until explicitly approved.

## GEO/AEO AI draft behavior

- `POST /api/audits/:id/geo/recommendations/draft` generates approval-gated draft recommendations from the audit's persisted evidence catalog.
- If an active AI provider is configured, the route uses the existing AI provider abstraction through a structured GEO/AEO prompt and validates JSON output before saving.
- If no provider is configured, the route creates deterministic fallback drafts from existing scanner recommendations or page-assessment evidence.
- Invalid AI JSON, missing evidence references, or prohibited guarantee/placement language are rejected without saving drafts.
- Prompt-injection text inside page/evidence data is treated as untrusted data, sanitized, and never executed as an instruction.

## GEO/AEO admin UI behavior

- Admins can select SEO, GEO/AEO, or hybrid mode when starting an audit.
- Audit lists and detail headers show audit mode and AI Visibility score when present.
- GEO/AEO audit detail includes a dedicated admin tab for score review, quick wins, risks, prompts, approved observations, and recommendations.
- Admins can approve recommendations into existing approved audit issues, edit recommendation copy/priority, hide recommendations from report export, recalculate the GEO/AEO score, and generate the Markdown report.
- GEO/AEO report creation is available from the reports page with Markdown enforced for `geo_aeo_audit`.

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
- PDF rendering for GEO/AEO should reuse the canonical payload later; Markdown is the first supported GEO/AEO export.
