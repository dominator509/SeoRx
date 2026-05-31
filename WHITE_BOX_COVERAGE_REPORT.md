# WHITE_BOX_COVERAGE_REPORT

## Scope
- Runtime: `artifacts/api-server`
- Command: `corepack pnpm exec vitest run --coverage --coverage.reporter=json-summary --coverage.reporter=text-summary`
- Coverage artifact: `artifacts/api-server/coverage/coverage-summary.json`
- Last run: 2026-05-27

## Achieved Coverage
- Statements: **61.73%** (1055/1709)
- Branches: **50.48%** (517/1024)
- Functions: **77.72%** (157/202)
- Lines: **62.70%** (977/1558)

## White Box Findings
- Highest-complexity logic (`seo-analyzer`) now has significantly expanded path coverage, including threshold pivots and false-branch clean paths.
- Security/exception paths were explicitly forced for integration boundaries (GSC callback malformed-state `400` path, webhook secret/events validation, malformed analytics payload rejection).
- Test bootstrap race around DB readiness/migration was stabilized through readiness polling + migration retry backoff.

## Remaining Gaps (Not Dead Code)
These are low-coverage modules with still-reachable paths that need additional white-box vectors:
- `routes/ai-providers.ts` (7.57% lines)
- `middlewares/clerkProxyMiddleware.ts` (18.18% lines)
- `routes/clients.ts` (36.23% lines)
- `lib/stripe.ts` (40.74% lines)
- `lib/auth.ts` (41.17% lines)
- `routes/organizations.ts` (49.39% lines)

## Dead/Unreachable Code Assessment
- No mathematically unreachable blocks were proven in this pass.
- Current deficits are primarily due to unexercised but reachable branches (provider permutations, proxy host permutations, billing env matrices, and role/tenant permutations), not compiler-dead paths.

## Artifacts Added During White Box Campaign
- `INTERNAL_STRUCTURE_MAP.md`
- `WHITEBOX_TAINT_MAP.md`
- `artifacts/api-server/coverage/coverage-summary.json`
- Expanded tests:
  - `artifacts/api-server/src/test/core.unit.test.ts`
  - `artifacts/api-server/src/test/api.integration.test.ts`
