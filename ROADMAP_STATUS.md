# SEORx Production Readiness Roadmap

Last updated: 2026-05-22

This file is the delivery source of truth. When asked to "proceed", pick the
highest priority item in this roadmap that is not complete, implement it, run
the listed verification, then update this file.

Related docs:
- `ARCHITECTURE.md`: current system architecture and ownership boundaries.
- `DEPLOYMENT_GUIDE.md`: production environment and release checklist.

## Current Position

Current phase: Phase 5, production operations.

The imported app has been cleaned into a buildable, testable monorepo with
Replit runtime artifacts removed. Core API, database, frontend, auth, generated
clients, CI, and browser test harness are in place. Primary business workflows
and integration contracts now have coverage, and the next push is production
operations: hosting selection, database migration policy, and release smoke
checks with real credentials.

## How To Advance This Roadmap

For each roadmap item:
1. Inspect the affected UI, API route, schema, and generated client surfaces.
2. Fix any wiring bug found while adding coverage.
3. Prefer realistic e2e coverage for user workflows and API integration tests
   for server behavior.
4. Run focused checks first.
5. Run broad checks before marking the item complete.
6. Update this roadmap with the result and any newly discovered risk.

Do not mark a workflow production-ready just because the page renders. A
workflow is ready only when the expected user action, API request, state
refresh, and visible result are covered.

## Verification Commands

Use these checks as the standard gate:

```powershell
corepack pnpm --filter @workspace/seorx run typecheck
corepack pnpm --filter @workspace/seorx run test:e2e
corepack pnpm test
corepack pnpm run build
git diff --check
```

Run `corepack pnpm test` and `corepack pnpm run build` sequentially. The API
integration suite provisions temporary database resources and should not be run
in parallel with the broad build.

If Playwright leaves transient output, remove `artifacts/seorx/test-results`
before final status.

## Completed Since Hardening Began

| Area | Status | Notes |
| --- | --- | --- |
| Replit banner cleanup | Complete | Product app no longer ships the "Made in Replit" banner. |
| Production auth guard | Complete | Missing Clerk publishable key now shows a clear production state instead of a broken app. |
| API integration test foundation | Complete | Vitest/Supertest coverage exists for protected API behavior and integration routes. |
| Frontend e2e harness | Complete | Playwright runs production auth-config and signed-in mocked workflows. |
| Dashboard e2e | Complete | Live metrics, recent audits, trends, and issue breakdown surfaces are mocked and asserted. |
| Clients e2e | Complete | Client list, search, and create workflow covered. |
| New audit e2e | Complete | Audit creation posts to API and redirects to audit detail route. |
| Issue triage e2e | Complete | Approve and dismiss actions update issue state and refresh visible data. |
| Issue triage stale-data fix | Complete | Global Issues page now invalidates the generated audit-issues query key after mutations. |
| Reports e2e | Complete | Report generation, refreshed list state, detail view, summary/top issues, and download link are covered. |
| Audit detail e2e | Complete | Issue filters, detail-page approve/dismiss refresh, and PageSpeed metrics/fallback messaging are covered. |
| AI providers e2e | Complete | Provider create, set default/active update, deactivate, list refresh, and delete behavior are covered. |
| Organizations and onboarding e2e | Complete | Organization create/list/member invite refresh plus first-run org/client/audit onboarding are covered. |
| Settings e2e | Complete | Profile load/update, refreshed visible state, and e2e-safe auth hook behavior are covered. |
| API contract hardening slice 1 | Complete | Audit creation/list, issue mutation RBAC, report list/detail/download, and report PDF generation are covered. |
| API contract hardening slice 2 | Complete | Dashboard stats, recent audits, issue breakdown, score trends, empty states, and concurrent first-login provisioning are covered. |
| API contract hardening slice 3 | Complete | Report creation generating-to-ready transitions, not-ready downloads, generated Zod response parity, and failed-generation state marking are covered. |
| Live integration readiness | Complete | GSC, PageSpeed, AI provider, outbound webhook, and Stripe degraded/live-mocked paths are covered at the API layer. |
| Production operations slice 1 | Complete | Deployment guide now documents host-agnostic assumptions, environment rules, health checks, DB push expectations, and CI gate sequencing. |
| Production operations slice 2 | Complete | Replit import files, Replit Vite plugins, workspace catalog entries, and Replit-specific install allowlist entries have been removed. |
| CI workflow | Complete | GitHub Actions runs typecheck, e2e, API tests, build, and diff check in release-gate order. |
| Production migration policy | Complete | Generated Drizzle migrations are the production policy, with CI drift checks and an initial audited schema migration committed. |
| Architecture e2e pass | Complete | Registered API surfaces were compared against OpenAPI/test coverage; developer API keys, billing, GSC callback, and report-download contracts were added or tightened. |
| Vite diagnostic cleanup | Complete | Inert Next.js-only `"use client"` directives were removed from Vite UI wrappers; product builds no longer emit sourcemap warning noise. |

## Active Roadmap

### Phase 0: Source Of Truth Documentation

Status: Complete.

Goal: Keep architecture and roadmap state durable inside the repo.

Acceptance:
- `ARCHITECTURE.md` describes the current package layout and ownership rules.
- `ROADMAP_STATUS.md` identifies current phase, next priorities, and verification gates.
- Future work can proceed from this file without relying on conversation memory.

### Phase 1: Import Cleanup And Baseline Stability

Status: Complete.

Completed:
- App builds with workspace commands.
- Replit user-facing banner removed.
- Auth misconfiguration has a clear fallback state.
- Typecheck, build, API tests, and e2e commands exist.

Completed:
- `.replit`, `.replitignore`, and stale Replit import notes were removed.
- Replit-only Vite development plugins were removed from product and mockup
  builds.
- Replit catalog dependencies and install allowlist entries were removed from
  workspace package management.

### Phase 2: Workflow Hardening

Status: Complete.

Goal: Prove the primary product workflows through browser-level tests and fix
live-data issues as they appear.

Completed workflows:
- Dashboard metrics.
- Client list/search/create.
- New audit creation.
- Issue approval and dismissal.
- Report generation/list/detail/download-link workflow.
- Audit detail issue filters, triage refresh, and PageSpeed metrics.
- AI provider create/update/default/active/delete workflow.
- Organization create/list/member invite refresh and first-run onboarding through audit creation.
- Settings profile load/update with refreshed visible state.

Next workflows:

| Priority | Workflow | Status | Acceptance |
| --- | --- | --- | --- |
| P0 | Reports list/generate/detail/download | Complete | Generate a report from a completed audit, see it in the list, open detail, verify ready/download behavior. |
| P1 | Audit detail PageSpeed and issue filters | Complete | Audit detail renders issue filters, PageSpeed states, and approve/dismiss behavior with refreshed data. |
| P1 | AI provider configuration | Complete | Create/update/set active/delete provider through UI with API mocked and visible state verified. |
| P1 | Organizations and onboarding | Complete | Org creation/member invite and onboarding completion are covered. |
| P2 | Settings | Complete | Profile update renders without Clerk hook errors and persists intended values. |

### Phase 3: API And Data Contract Hardening

Status: Complete.

Goal: Ensure API routes, database schema, OpenAPI, generated clients, and UI
expectations stay aligned.

Completed:
- OpenAPI codegen is in place.
- API integration tests exist.
- Integration persistence schema and routes exist.
- API integration tests cover audit creation/list scoping, issue approve/dismiss
  RBAC, report list/detail/download contracts, and PDF download generation.
- API integration tests cover dashboard stats, recent audits, issue breakdown,
  score trends, empty aggregate states, and concurrent first-login user
  provisioning.
- API integration tests parse dashboard/report responses through generated
  OpenAPI/Zod schemas, including report creation async status transitions and
  not-ready download behavior.
- Developer API key management and key-based authorization are covered at the
  API layer, including no-hash/no-secret list responses and inactive-key
  rejection.
- Report generation failures are recorded as `failed` instead of leaving
  reports stuck in `generating`.

Next:
- Verify generated clients after every OpenAPI change.
- Continue into Phase 5 production operations.

### Phase 4: Live Integration Readiness

Status: Complete.

Goal: Make optional live integrations reliable, testable, and clearly degraded
when credentials are absent.

Completed:
- Google Search Console connect, unavailable, connected properties, analytics,
  and token refresh paths are covered with mocked-contract API tests.
- PageSpeed unavailable, live-key, cache, and API-failure fallback paths are
  covered with generated response-schema assertions.
- AI provider success and failure paths are covered through the async audit
  recommendation flow.
- Outbound webhook registration, test delivery success/failure, safe secret
  handling, and delivery status persistence are covered.
- Stripe plans, disabled checkout, billing org authorization, portal guardrails,
  and webhook signature failure states are covered.

### Phase 5: Production Operations

Status: Partial.

Goal: Make the app deployable and operable outside the original import context.

Next:
Completed:
- Host-agnostic deployment assumptions are documented in `DEPLOYMENT_GUIDE.md`.
- Required and optional environment variables are documented with production
  handling rules.
- Release smoke checks include API health, OpenAPI/docs, auth, CORS, core
  workflows, billing disabled state, and optional integration degradation.
- Generated migration expectations and direct-push restrictions are documented.
- Verification command sequencing is documented as the release gate.
- Initial Drizzle migration history exists in `lib/db/migrations`.
- CI checks migration consistency with `@workspace/db` before e2e/API/build.
- API integration tests apply generated migrations instead of direct schema
  pushes.

Next:
- Confirm the final target hosting vendor.
- Add environment-backed optional live smoke checks once production credentials
  exist.
- Product and mockup Vite builds no longer emit the previous UI wrapper
  sourcemap warning noise.

## Known Risks

| Risk | Impact | Next action |
| --- | --- | --- |
| External API behavior depends on credentials | CI cannot rely on real providers by default. | Keep deterministic mocks in CI and add optional environment-backed smoke checks once production credentials exist. |
| Existing direct-pushed databases may not have migration history | Applying generated migrations to those databases without reconciliation can fail or duplicate objects. | Treat new production databases as migration-managed from day one; reconcile any existing environment before promotion. |

## Next Best Step

Implement the next Phase 5 production operations slice:
1. Confirm the final target hosting vendor or keep documenting host-agnostic assumptions.
2. Add environment-backed optional live smoke checks once production credentials exist.
3. Run the standard verification gate.
