# SEORx Production Readiness Roadmap

Last updated: 2026-05-19

This file is the delivery source of truth. When asked to "proceed", pick the
highest priority item in this roadmap that is not complete, implement it, run
the listed verification, then update this file.

Related docs:
- `ARCHITECTURE.md`: current system architecture and ownership boundaries.
- `DEPLOYMENT_GUIDE.md`: production environment and release checklist.

## Current Position

Current phase: Phase 3, API and data contract hardening.

The imported Replit app has been cleaned into a buildable, testable monorepo.
Core API, database, frontend, auth, generated clients, and browser test harness
are in place. Primary business workflows now have browser coverage, and the
next push is proving API behavior, RBAC, response shapes, and generated
contract alignment more deeply.

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

## Active Roadmap

### Phase 0: Source Of Truth Documentation

Status: Complete.

Goal: Keep architecture and roadmap state durable inside the repo.

Acceptance:
- `ARCHITECTURE.md` describes the current package layout and ownership rules.
- `ROADMAP_STATUS.md` identifies current phase, next priorities, and verification gates.
- Future work can proceed from this file without relying on conversation memory.

### Phase 1: Import Cleanup And Baseline Stability

Status: Mostly complete.

Completed:
- App builds with workspace commands.
- Replit user-facing banner removed.
- Auth misconfiguration has a clear fallback state.
- Typecheck, build, API tests, and e2e commands exist.

Remaining:
- Decide whether `.replit`, `.replitignore`, and Replit catalog package entries are still needed for the chosen host.
- Remove or isolate remaining Replit-only development affordances if the production target is not Replit.

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

Status: Partial.

Goal: Ensure API routes, database schema, OpenAPI, generated clients, and UI
expectations stay aligned.

Completed:
- OpenAPI codegen is in place.
- API integration tests exist.
- Integration persistence schema and routes exist.

Next:
- Expand API integration tests for reports, issue mutations, audit creation,
  and RBAC denial cases.
- Add regression tests for response shapes used by dashboard and reports.
- Verify generated clients after every OpenAPI change.

### Phase 4: Live Integration Readiness

Status: Partial.

Goal: Make optional live integrations reliable, testable, and clearly degraded
when credentials are absent.

Next:
- Google Search Console connect/properties/analytics contract tests.
- PageSpeed live-key smoke path plus fallback assertions.
- AI provider live/fallback behavior tests.
- Outbound webhook registration and test delivery coverage.
- Stripe disabled-state and webhook signature coverage.

### Phase 5: Production Operations

Status: Pending.

Goal: Make the app deployable and operable outside the original import context.

Next:
- Confirm target hosting model.
- Validate required environment variables.
- Add deployment health-check runbook.
- Confirm database migration/push path.
- Add logging and error-handling expectations.
- Decide on CI sequencing for typecheck, API tests, e2e, and build.

## Known Risks

| Risk | Impact | Next action |
| --- | --- | --- |
| API contract coverage is thinner than browser workflow coverage | Backend response drift or RBAC regressions could still reach the UI. | Expand reports, issue mutation, audit creation, and RBAC API tests next. |
| Optional integrations need stronger proof | Metrics may appear missing or stale when live keys are configured incorrectly. | Add mocked-contract and live-key smoke tests. |
| Replit-specific files remain | Deployment expectations may be unclear for non-Replit hosts. | Decide target host and remove or document remaining Replit files. |
| Vite sourcemap warnings remain | Builds pass, but diagnostics are noisy. | Investigate after workflow coverage is broader. |
| External API behavior depends on credentials | CI cannot rely on real providers by default. | Use deterministic mocks plus optional live smoke checks. |

## Next Best Step

Implement the first Phase 3 API and data contract hardening slice:
1. Inspect reports, issue mutations, audit creation, RBAC helpers, and generated client response expectations.
2. Add API integration tests for the highest-risk missing server behaviors.
3. Fix any authorization, response-shape, or stale contract issue uncovered.
4. Run focused API tests, then the standard verification gate.
