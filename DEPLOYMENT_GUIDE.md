# SEORx Deployment Guide

Last updated: 2026-05-22

This guide is the production release checklist. It should be read with
`ARCHITECTURE.md` and `ROADMAP_STATUS.md`.

## Runtime Requirements

- Node.js 24 or compatible current Node runtime
- pnpm via Corepack
- PostgreSQL database
- Clerk application keys
- HTTPS-capable hosting/proxy

## Target Hosting Model

Until a specific vendor is selected, production readiness assumes a
host-agnostic deployment:

- The Express API runs as a long-lived Node service from
  `artifacts/api-server`.
- The React/Vite frontend is built from `artifacts/seorx` and served by the
  selected platform or static asset layer.
- `/api/*` traffic reaches the Express API.
- Frontend routes fall back to `index.html`.
- PostgreSQL is managed outside the app container/process.
- TLS terminates at the platform, proxy, or load balancer.

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

Production rules:
- `ALLOWED_ORIGINS` must include the public frontend origin exactly.
- `API_BASE_URL` should be the public API base URL used by OAuth callbacks and
  webhook links.
- `ENCRYPTION_KEY` should be stable across deploys; changing it can prevent
  existing encrypted provider tokens/secrets from decrypting.
- Clerk keys must come from the same Clerk application/environment.

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

Optional live credential smoke checks can be run locally after
`.env.production.local` is populated. This command does not print secret values
and keeps paid-provider usage bounded to metadata checks plus one small
PageSpeed request:

```powershell
corepack pnpm --filter @workspace/scripts run smoke:live
```

The live smoke command validates:
- Postgres connectivity with a read-only query.
- Clerk secret-key access to instance metadata.
- Stripe account access, configured monthly price IDs, and webhook secret shape.
- Google OAuth client credentials using an intentionally invalid auth code.
- PageSpeed API access against a safe URL.
- OpenAI, Anthropic, and Gemini model-list access without generation.

## Database

Schema ownership lives in `lib/db/src/schema`.

Before release:
1. Confirm `DATABASE_URL` points at the intended database.
2. Review pending schema changes.
3. Generate and review an auditable migration for every schema change.
4. Run the reviewed migrations against the target environment.
5. Confirm the API can read/write tenant-scoped data.

Generate migrations:

```powershell
corepack pnpm --filter @workspace/db exec drizzle-kit generate --config ./drizzle.config.ts --name <migration_name>
```

Apply migrations:

```powershell
corepack pnpm --filter @workspace/db run migrate
```

Check migration consistency:

```powershell
corepack pnpm --filter @workspace/db run check
```

Production rule: do not use direct Drizzle pushes for production databases.
`push` and `push-force` remain available only for disposable local or test
databases. Existing databases that were created through direct pushes must be
reconciled with the committed migration history before they are treated as
production environments.

Rollback note: rollback is handled through a reviewed follow-up migration or a
database restore from a verified backup, depending on the severity and data
impact of the release.

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

Operational smoke checks:

11. API logs show request IDs, status codes, and no startup errors.
12. A protected API route returns `401` when unauthenticated.
13. CORS rejects an origin that is not in `ALLOWED_ORIGINS`.
14. Billing checkout returns a safe disabled response if Stripe is not
    configured.
15. Optional integrations degrade clearly when credentials are absent.

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
- Billing checkout and portal routes must only act on organizations the user
  can access.

Webhooks:
- Outbound webhook registrations persist.
- Test delivery returns a clear success/failure result.

## Known Pre-Launch Gaps

Track completion in `ROADMAP_STATUS.md`.

- Final target hosting vendor needs confirmation.
- Optional provider live smoke checks need real production credentials and
  should stay outside default CI.
- Vite sourcemap warnings are non-failing but still noisy.
