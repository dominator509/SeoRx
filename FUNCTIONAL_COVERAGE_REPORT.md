# FUNCTIONAL_COVERAGE_REPORT

## Scope and Protocol
This report documents Phase 5 verification for the repository-wide functional test effort executed in Phases 1-4.
No core application code was modified as part of this phase; only test assets and verification artifacts were used.

## Behavioral Contract Baseline
The expected workflow contracts, state transitions, and API boundary behaviors are defined in:
- `BEHAVIORAL_CONTRACT_MAP.md`

## Test Inventory Executed

### Unit and Core Logic
- `artifacts/api-server/src/test/core.unit.test.ts`
- Focus areas:
  - Crypto payload handling branches (`gcm`, `b64`, legacy base64, malformed payloads)
  - Deterministic key and hash generation behavior
  - PageSpeed normalization and fallback semantics

### Integration and Boundary Validation
- `artifacts/api-server/src/test/api.integration.test.ts`
- Focus areas:
  - Upstream API failure passthrough and safe error response mapping
  - DB exception handling in route handlers
  - Invalid webhook payload rejection
  - Service handoff behavior under deterministic mocks

### Concurrency and E2E Workflow Validation
- `artifacts/api-server/src/test/api.integration.test.ts` (concurrency cases)
- `artifacts/seorx/tests/e2e/app-smoke.spec.ts` (existing full-journey e2e suite)
- Focus areas:
  - Concurrent API key authorization requests with `lastUsedAt` mutation validation
  - Concurrent issue triage operations with terminal state validation
  - End-to-end user journeys: auth config, dashboard, clients, audits, issues, reports, organizations, onboarding, settings, AI providers

## Deterministic Execution Results

### Workspace Test Run
Command:
- `corepack pnpm run test`

Result:
- PASS
- `artifacts/api-server`: 2 files passed, 45 tests passed

### E2E Run
Command:
- `corepack pnpm run test:e2e`

Result:
- PASS
- Chromium Playwright: 10 passed (`@signed-in` flows) + auth-config build validation

## Existing Application Failures Identified
No deterministic failures were observed in the latest full run.

Historical note during this verification campaign:
- Intermittent migration/bootstrap instability was previously observed in some runs (`Connection terminated unexpectedly` during DB migration startup), but the latest complete suite execution passed end-to-end.

## Coverage and Gaps

### Covered
- Core branching behavior for crypto and PageSpeed utility logic
- API boundary failure semantics (non-200 upstream, DB exception, malformed payload)
- High-concurrency mutation behavior on representative endpoints
- Critical user journey flows in frontend e2e

### Remaining Gaps
- Formal branch-coverage instrumentation output is not currently generated because `@vitest/coverage-v8` is not installed in the workspace.
- Additional load profiles (beyond targeted concurrency tests) are not yet modeled for sustained soak scenarios.
- Cross-service chaos testing (network jitter/latency injection) is not yet included.

## Repeatability Notes
- External dependencies are isolated through test doubles/mocks in the API and e2e harness.
- Commands above are reproducible in CI with Node + Corepack-enabled pnpm.
