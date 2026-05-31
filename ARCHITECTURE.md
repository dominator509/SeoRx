# SEORx Architecture

Last updated: 2026-05-27

This file is the architecture source of truth for the current repo. Use
`ROADMAP_STATUS.md` for delivery sequencing and `DEPLOYMENT_GUIDE.md` for
environment and release checks.

## System Overview

SEORx is a multi-tenant SEO auditing and reporting platform. It is organized as
a pnpm monorepo with a React frontend, an Express API, and shared libraries for
database schema, generated API clients, and OpenAPI contract ownership.

```text
Seo-Rx-Insights/
  artifacts/
    api-server/        Express API server under /api
    seorx/             React + Vite product app
    mockup-sandbox/    Separate visual/mockup artifact app
  lib/
    api-spec/          OpenAPI source of truth and Orval config
    api-client-react/  Generated React Query hooks
    api-zod/           Generated Zod schemas
    db/                Drizzle schema and database client
  scripts/             Shared workspace scripts
```

## Package Responsibilities

| Package | Responsibility |
| --- | --- |
| `artifacts/seorx` | User-facing app, routing, Clerk UI, React Query views, Playwright e2e tests. |
| `artifacts/api-server` | Authenticated API, RBAC, crawler orchestration, reports, integrations, billing, API tests. |
| `lib/db` | Drizzle schema for users, orgs, clients, audits, issues, reports, integrations, API keys, PageSpeed, AI providers. |
| `lib/api-spec` | OpenAPI contract. Generated clients should come from here, not hand-written endpoint shapes. |
| `lib/api-client-react` | Generated React Query hooks used by the frontend. |
| `lib/api-zod` | Generated validation schemas used by backend/API typing surfaces. |

## Frontend

The primary frontend lives in `artifacts/seorx`.

Key technologies:
- React 19
- Vite 7
- Wouter routing
- Clerk React auth
- React Query via generated hooks from `@workspace/api-client-react`
- Tailwind CSS v4 and Radix UI primitives
- Playwright for browser workflow coverage

Core routes:
- `/` public/auth entry
- `/dashboard` metrics, trends, and recent audits
- `/clients` and `/clients/:id`
- `/audits`, `/audits/new`, and `/audits/:id`
- `/issues`
- `/reports` and `/reports/:id`
- `/ai-providers`
- `/organizations`
- `/settings`
- `/onboarding`

Frontend rule: API calls should use generated hooks from
`@workspace/api-client-react`. If a response shape or endpoint changes, update
`lib/api-spec/openapi.yaml` and regenerate clients.

## Backend

The API server lives in `artifacts/api-server`.

Key technologies:
- Node.js ESM build through esbuild
- Express 5
- Clerk Express auth
- Drizzle ORM and PostgreSQL
- Pino logging
- Helmet, CORS, and express-rate-limit
- PDFKit reports
- Stripe billing integration
- Google Search Console and PageSpeed integration surfaces
- OpenAI, Anthropic, Gemini, Ollama, and custom OpenAI-compatible AI provider support

API route areas:
- Auth/profile
- Organizations and members
- Clients
- Audits and audit issues
- Issue approval and dismissal
- Reports and PDF download
- Dashboard metrics
- AI providers
- PageSpeed
- Billing and Stripe webhooks
- Developer API keys
- Integrations, including GSC and outbound webhooks
- Swagger/OpenAPI docs

Backend rule: all protected data access must be scoped through authenticated
user context and org/client/audit access helpers. Do not add unscoped reads for
tenant data.

## Auth, Tenancy, And RBAC

Clerk handles user authentication. The API loads SEORx user and organization
membership context for authenticated requests.

Tenant boundaries are organization-based:
- Users belong to organizations through membership rows.
- Clients belong to organizations.
- Audits belong to clients.
- Issues belong to audits.
- Reports belong to audits and clients.
- Integration records are organization-scoped.

RBAC helpers enforce access at API boundaries:
- `requireAuth`
- `requireOrgMember`
- `requireOrgRole`
- `assertClientAccess`
- `assertAuditAccess`
- `getAllowedClientIds`

Human approval is part of the product model. AI-generated issue
recommendations stay in review until a user approves or dismisses them.

## Database

Schema lives in `lib/db/src/schema`.

Important table groups:
- Identity and tenancy: `users`, `organizations`, `org_members`
- SEO workflow: `clients`, `audits`, `audit_issues`, `page_speed_results`
- Output: `reports`
- Configuration: `ai_providers`, `integrations`
- Developer access: `api_keys`

Database changes should be made in the Drizzle schema first, then captured in a
generated migration under `lib/db/migrations`. Production databases use reviewed
migrations through the DB package `migrate` workflow; direct Drizzle pushes are
reserved for disposable local or test databases.

## API Contract And Codegen

The OpenAPI file in `lib/api-spec/openapi.yaml` is the contract source of truth.

When API routes or response shapes change:
1. Update `lib/api-spec/openapi.yaml`.
2. Run `corepack pnpm --filter @workspace/api-spec run codegen`.
3. Use generated hooks/schemas in app and API code.
4. Typecheck the workspace.

Generated files should not be edited by hand except as part of generated output
from the codegen command.

## Testing Architecture

Current test layers:
- API integration tests in `artifacts/api-server/src/test`.
- Browser e2e tests in `artifacts/seorx/tests/e2e`.
- TypeScript checks across libraries, artifacts, and scripts.
- Workspace builds for API, frontend, and mockup artifact.

Current API coverage includes:
- Auth/profile creation and update behavior.
- Client and organization scoping.
- Organization member invite and RBAC denial behavior.
- Audit creation/list response contracts and tenant scoping.
- Issue approve/dismiss mutation authorization.
- Report list/detail/download contracts, including PDF generation.
- Dashboard stats, recent audits, issue breakdown, score trends, and empty
  aggregate states parsed through generated response schemas.
- Report creation generating-to-ready transitions, not-ready download behavior,
  generated response-schema parity, and failed-generation state marking.
- Concurrent first-login user provisioning.
- Google Search Console unavailable, OAuth redirect, connected properties,
  analytics, and token refresh paths.
- PageSpeed unavailable, live-key, cache, and API-failure fallback paths.
- AI provider audit recommendation success and failure fallback behavior.
- Outbound webhook registration, test delivery success/failure, safe secret
  handling, and delivery status persistence.
- Stripe plans, disabled checkout, billing org authorization, portal guardrails,
  and webhook signature failure states.
- Developer API key creation/list/update and key-based authorization, including
  inactive-key rejection and hidden key hashes.
- Google Search Console callback malformed-state rejection with deterministic
  `400` response (no internal parser error leakage).

Current e2e coverage includes:
- Production auth misconfiguration fallback.
- Signed-in dashboard live metric surfaces.
- Client list, search, and create workflow.
- New audit submission and redirect workflow.
- Issue approval and dismissal workflow with refreshed live data.
- Report generation/list/detail/download-link workflow.
- Audit detail issue filters, triage refresh, and PageSpeed metrics.
- AI provider create/update/default/active/delete workflow.
- Organization create/list/member invite refresh and first-run onboarding.
- Settings profile load/update with refreshed visible state.

Important test caveat: API integration tests create temporary database
resources. Run root API tests and full workspace build sequentially, not in
parallel.

## Production Boundary

The product has been moved away from Replit-specific assumptions toward a
host-agnostic production posture. Replit import config files and Replit-only
Vite development plugins have been removed; product runtime behavior should not
depend on Replit branding or Replit-only development affordances.

Production-critical environment variables:
- `DATABASE_URL`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `SESSION_SECRET`
- `ALLOWED_ORIGINS`
- `ENCRYPTION_KEY` recommended for real secret encryption

Optional integration variables:
- `PAGESPEED_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_*_MONTHLY`
- `API_BASE_URL`

## Known Architecture Risks

These are not necessarily broken, but they are still production-readiness risks:

1. Production deployment runbooks need validation against the target host.
2. Optional live provider smoke checks still depend on real production
   credentials and should remain outside default CI.
3. Target-host deployment checks still need to be exercised against the chosen
   production vendor.
