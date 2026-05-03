# SEORx Architecture

> Last updated: 2026-05-03

## Overview

SEORx is a multi-tenant SaaS platform for AI-powered SEO auditing, issue prioritization, and client reporting. It is built as a **pnpm monorepo** with a clear separation between the API backend, the React frontend, and shared libraries.

```
workspace/
├── artifacts/
│   ├── api-server/          Express 5 API — /api path prefix
│   └── seorx/               React + Vite frontend — / path prefix
├── lib/
│   ├── api-spec/            OpenAPI 3.1 specification (source of truth)
│   ├── api-client-react/    Generated React Query hooks (via Orval)
│   ├── api-zod/             Generated Zod validation schemas (via Orval)
│   └── db/                  Drizzle ORM schema, migrations, DB client
└── scripts/                 Shared utility scripts
```

---

## Request Routing

A global reverse proxy (Replit's path-based router) routes all traffic:

| Path prefix | Service            | Port |
|-------------|--------------------|------|
| `/api`      | Express API server | 8080 |
| `/`         | React + Vite SPA   | PORT |

All traffic flows through `localhost:80` in development and through the `.replit.app` domain in production.

---

## Backend (`artifacts/api-server`)

### Technology Stack
- **Runtime**: Node.js 24, ESM output via ESBuild
- **Framework**: Express 5 (async error handling natively)
- **Auth**: Clerk (`@clerk/express`) — session-based with proxy middleware
- **Database**: PostgreSQL via Drizzle ORM (parameterized queries only)
- **Logging**: Pino (structured JSON, pino-http for request logging)
- **Security**: Helmet (CSP/HSTS), express-rate-limit (3 tiers), CORS origin allowlist
- **Billing**: Stripe (checkout sessions, customer portal, webhook verification)
- **PDF**: PDFKit (branded multi-page reports streamed directly)
- **Crawler**: node-fetch + cheerio + robots-parser (rate-limited, robots.txt-aware)
- **AI**: OpenAI, Anthropic, Gemini, Ollama adapters — all via stored encrypted credentials

### Middleware Stack (in order)

```
Helmet (security headers)
↓
CORS
↓
Pino HTTP logging
↓
Clerk proxy (/__clerk path)
↓
Raw body parser (Stripe webhook only)
↓
JSON / URL-encoded body parsers
↓
Clerk session middleware (attaches auth context)
↓
loadUserContext (RBAC — loads user record + org memberships)
↓
Rate limiters (global 500/15m, audit 20/hr, webhook 100/min)
↓
Route handlers
```

### RBAC System (`lib/rbac.ts`)

Every authenticated request gets a user record and all org memberships preloaded by `loadUserContext`. Route handlers use zero-cost helpers:

| Helper | Purpose |
|--------|---------|
| `requireAuth` | Enforces authentication (uses preloaded context) |
| `requireOrgMember(orgIdParam)` | Verifies org membership |
| `requireOrgRole(minRole, orgIdParam)` | Enforces minimum role |
| `getUserOrgIds(req)` | Returns all org IDs the user belongs to |
| `getMembershipForOrg(req, orgId)` | Returns the membership record for one org |
| `assertClientAccess(req, clientId)` | Verifies client belongs to one of user's orgs |
| `assertAuditAccess(req, auditId)` | Verifies audit belongs to one of user's orgs |

**Org roles (lowest → highest privilege):** `viewer → client → agency → admin`

### Plan Enforcement (`lib/plan-enforcement.ts`)

Middleware applied before resource-creation routes:

| Middleware | Applied to | What it checks |
|------------|-----------|----------------|
| `enforceClientLimit()` | `POST /api/clients` | `clientsMax` for org plan |
| `enforceAuditLimit()` | `POST /api/audits` | `auditsPerMonth` for org plan |
| `enforceAiLimit()` | `POST /api/audits` | `aiRecommendations` flag |

Plans: `free → starter → professional → enterprise`

### Encryption (`lib/crypto.ts`)

API provider keys and sensitive values are encrypted at rest:

- **With `ENCRYPTION_KEY` set**: AES-256-GCM (authenticated encryption, random IV per write)
- **Without `ENCRYPTION_KEY`**: base64 fallback with a startup warning
- Format: `gcm:<base64(iv:tag:ciphertext)>` or `b64:<base64(value)>`
- Developer API keys are hashed with SHA-256 (one-way, never stored in plaintext)

### SEO Crawler (`lib/crawler.ts`)

Real multi-page crawler with:
- `robots.txt` fetch + enforcement per URL
- Configurable rate limit (default 300ms between requests)
- Max depth (4) and max pages (plan-limited) controls
- 18+ issue detection rules across 8 categories
- Priority scoring algorithm (0–100 per issue)

### AI Recommendation Pipeline (`lib/ai-adapter.ts`)

Supports: OpenAI, Anthropic Claude, Google Gemini, Ollama, Custom OpenAI-compatible

1. Audit completes → top 10 issues by priority selected
2. AI generates targeted fix recommendation for each issue
3. Recommendations stored in `audit_issues.ai_recommendation`
4. **Never auto-applied** — require explicit human `approve` action
5. Only approved recommendations appear in PDFs and client reports

### API Documentation

Interactive Swagger UI available at `/api/docs` (development and production).  
Raw OpenAPI JSON at `/api/openapi.json`.

---

## Database (`lib/db`)

### Schema Tables

| Table | Purpose |
|-------|---------|
| `users` | User records (clerkId, global role) |
| `organizations` | Multi-tenant orgs (plan, slug) |
| `org_members` | User ↔ org membership + role |
| `clients` | SEO clients (domain, last score, last audit) |
| `audits` | Audit jobs (status, score, crawl metadata) |
| `audit_issues` | Individual SEO issues (severity, category, status, AI rec) |
| `reports` | Generated reports (format, status, summary) |
| `ai_providers` | Configured AI providers (encrypted API keys) |
| `page_speed_results` | Core Web Vitals per audit (mobile + desktop) |
| `api_keys` | Developer API keys (hash only, never plaintext) |

### ORM

Drizzle ORM with `drizzle-zod` for insert schemas. All queries are parameterized — no raw SQL interpolation of user input.

Push migrations: `pnpm --filter @workspace/db run push`

---

## Frontend (`artifacts/seorx`)

### Technology Stack
- **Framework**: React 18 + Vite 7
- **Auth**: Clerk React (`@clerk/clerk-react`)
- **Data fetching**: React Query + generated hooks (`@workspace/api-client-react`)
- **Styling**: Tailwind CSS v4
- **Charts**: Recharts
- **Routing**: React Router v6

### Key Pages

| Route | Page |
|-------|------|
| `/` | Landing page (public) |
| `/dashboard` | Stats, score trends, recent audits |
| `/clients` | Client list + search |
| `/clients/:id` | Client detail + audit history |
| `/audits` | Audit job list |
| `/audits/new` | New audit form |
| `/audits/:id` | Audit detail — issues + PageSpeed tab |
| `/reports` | Report list + generation |
| `/reports/:id` | Report detail + PDF download |
| `/ai-providers` | AI provider configuration |
| `/organizations` | Org management |
| `/settings` | User settings |
| `/sign-in`, `/sign-up` | Clerk auth pages (custom branded) |

### API Client

All HTTP calls go through generated React Query hooks in `@workspace/api-client-react`. The OpenAPI spec (`lib/api-spec/openapi.yaml`) is the single source of truth — never write API calls manually.

Regenerate hooks: `pnpm --filter @workspace/api-spec run codegen`

---

## Developer API Keys

Programmatic API access uses `srx_` prefixed keys:
1. Create via `POST /api/api-keys` (full key shown once)
2. Key is SHA-256 hashed and stored — plaintext never persisted
3. Authenticate by passing key as `Authorization: Bearer srx_<key>` header
4. Key middleware resolves org context and applies same RBAC as session auth

---

## Billing (Stripe)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/billing/plans` | Plan comparison (public) |
| `POST /api/billing/checkout` | Create checkout session |
| `POST /api/billing/portal` | Open customer billing portal |
| `POST /api/billing/webhook` | Handle Stripe events |

**Required environment variables:**
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER_MONTHLY`
- `STRIPE_PRICE_PROFESSIONAL_MONTHLY`
- `STRIPE_PRICE_ENTERPRISE_MONTHLY`

---

## Integrations

### Google Search Console
OAuth 2.0 flow via `/api/integrations/gsc/connect`. Imports keyword rankings, impressions, CTR, and position data per page. Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### Outbound Webhooks (Zapier / Make / n8n)
Register endpoints via `POST /api/integrations/webhooks`. Events:
- `audit.completed`
- `issue.approved` / `issue.dismissed`
- `report.ready`

Test delivery via `POST /api/integrations/webhooks/test`.

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `CLERK_PUBLISHABLE_KEY` | ✅ | Clerk auth (frontend) |
| `CLERK_SECRET_KEY` | ✅ | Clerk auth (backend) |
| `SESSION_SECRET` | ✅ | Session signing |
| `ENCRYPTION_KEY` | Recommended | AES-256-GCM for API key encryption |
| `PAGESPEED_API_KEY` | Optional | Real PageSpeed Insights API v5 |
| `STRIPE_SECRET_KEY` | Optional | Stripe billing |
| `STRIPE_WEBHOOK_SECRET` | Optional | Stripe webhook verification |
| `STRIPE_PRICE_*_MONTHLY` | Optional | Stripe price IDs per plan |
| `GOOGLE_CLIENT_ID` | Optional | GSC OAuth |
| `GOOGLE_CLIENT_SECRET` | Optional | GSC OAuth |
| `ALLOWED_ORIGINS` | Production | Comma-separated CORS origins |
| `API_BASE_URL` | Optional | Base URL for OAuth redirect URIs |

---

## Human Approval Workflow

All AI-generated content is gated by explicit human approval before it can appear in client-facing output:

```
Audit runs → Issues found → AI recommendations generated
    ↓
Issues stored with status: "open"
AI recommendations stored in aiRecommendation field
    ↓
Human reviews in SEORx dashboard
    ↓
approve → status: "approved" (included in PDF, client report)
dismiss → status: "dismissed" (excluded from all output)
    ↓
Reports only include approved AI recommendations
PDF generation uses aiRecommendation only when status === "approved"
```

---

## Security Posture

| Control | Implementation |
|---------|---------------|
| Authentication | Clerk JWT sessions (OAuth, passkey, email) |
| Authorization | RBAC middleware + org-scoped DB queries |
| Transport | HTTPS enforced in production (Replit proxy) |
| Security headers | Helmet.js (CSP, HSTS, X-Frame, X-Content-Type) |
| Rate limiting | 3 tiers: global, per-user audits, webhooks |
| CORS | Origin allowlist in production |
| SQL injection | Drizzle ORM parameterized queries only |
| Secrets at rest | AES-256-GCM (with ENCRYPTION_KEY) |
| API keys | SHA-256 hashed, never stored plaintext |
| Stripe webhooks | Signature verification via constructWebhookEvent |
| Input validation | Zod schemas on all write endpoints |
| Body size limits | 2 MB max (except Stripe raw webhook) |
| Crawler safety | robots.txt enforced, rate-limited, max pages capped |
