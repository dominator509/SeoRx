# SEORx Deployment Guide

Last updated: 2026-05-15

This guide is the production release checklist. It should be read with
`ARCHITECTURE.md` and `ROADMAP_STATUS.md`.

## Runtime Requirements

- Node.js 24 or compatible current Node runtime
- pnpm via Corepack
- PostgreSQL database
- Clerk application keys
- HTTPS-capable hosting/proxy

Optional services:
- PageSpeed Insights API key
- Google Search Console OAuth app
- Stripe account and webhook secret
- AI provider credentials

## Required Environment Variables

Set these before production release:

```text
DATABASE_URL
CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
SESSION_SECRET
ALLOWED_ORIGINS
```

Strongly recommended:

```text
ENCRYPTION_KEY
API_BASE_URL
```

Optional integration variables:

```text
PAGESPEED_API_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_STARTER_MONTHLY
STRIPE_PRICE_PROFESSIONAL_MONTHLY
STRIPE_PRICE_ENTERPRISE_MONTHLY
```

## Build And Test Gate

Run these before a release candidate is marked ready:

```powershell
corepack pnpm --filter @workspace/seorx run typecheck
corepack pnpm --filter @workspace/seorx run test:e2e
corepack pnpm test
corepack pnpm run build
git diff --check
```

Run the API test suite and broad build sequentially. The API integration tests
create temporary database resources and should not be run in parallel with the
workspace build.

## Database

Schema ownership lives in `lib/db/src/schema`.

Before release:
1. Confirm `DATABASE_URL` points at the intended database.
2. Review pending schema changes.
3. Run the DB package push/migration process for the target environment.
4. Confirm the API can read/write tenant-scoped data.

Current command:

```powershell
corepack pnpm --filter @workspace/db run push
```

Use the production team's migration policy if it differs from direct Drizzle
pushes.

## App Build Outputs

API:
- Source: `artifacts/api-server`
- Build: `corepack pnpm --filter @workspace/api-server run build`
- Start: `corepack pnpm --filter @workspace/api-server run start`

Frontend:
- Source: `artifacts/seorx`
- Build: `corepack pnpm --filter @workspace/seorx run build`
- Preview: `corepack pnpm --filter @workspace/seorx run serve`

## Release Smoke Checks

After deployment:

1. `/api/healthz` returns healthy JSON.
2. `/api/openapi.json` returns the OpenAPI contract.
3. `/api/docs` loads Swagger UI when docs are enabled.
4. The frontend loads without the production auth fallback when Clerk keys are set.
5. A signed-in user can open `/dashboard`.
6. Dashboard metrics load for that user's organization.
7. Client list loads and can create a client in a safe test org.
8. A small audit can be started against a safe URL.
9. Issue approval/dismissal updates visible state.
10. Report generation and download are verified before launch signoff.

## Integration Smoke Checks

For optional services, verify both configured and unconfigured states.

PageSpeed:
- Without `PAGESPEED_API_KEY`, fallback behavior should be clear and non-fatal.
- With `PAGESPEED_API_KEY`, PageSpeed metrics should be stored and shown.

Google Search Console:
- OAuth connect URL is generated.
- Callback handles expected provider response.
- Properties and analytics endpoints return tenant-scoped data.

AI providers:
- Provider secrets are encrypted when `ENCRYPTION_KEY` is set.
- Failed provider calls should not break audit completion.
- AI recommendations remain gated by human approval.

Stripe:
- Billing endpoints are disabled or safe when Stripe env vars are absent.
- Webhook signature verification is required when Stripe is enabled.

Webhooks:
- Outbound webhook registrations persist.
- Test delivery returns a clear success/failure result.

## Known Pre-Launch Gaps

Track completion in `ROADMAP_STATUS.md`.

- Organizations and onboarding need the next browser-level hardening pass.
- Optional integrations need stronger mocked-contract and live-key smoke tests.
- Final target hosting model needs confirmation.
- Vite sourcemap warnings are non-failing but still noisy.
