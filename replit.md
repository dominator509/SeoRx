# SEORx — AI-Powered SEO Audit Platform

## Project Overview

SEORx is a production-ready multi-tenant SaaS platform for SEO audits, issue prioritization, AI-powered fix recommendations, report generation, and client management — built for digital agencies, solo SEO consultants, and local business operators.

## Architecture

```
artifacts/seorx/          # React + Vite frontend (previewPath: "/")
artifacts/api-server/     # Express 5 API server (previewPath: "/api")
lib/api-spec/             # OpenAPI 3.1 spec + Orval codegen config
lib/api-client-react/     # Generated React Query hooks (from Orval)
lib/api-zod/              # Generated Zod validation schemas (from Orval)
lib/db/                   # Drizzle ORM schema + migrations
scripts/                  # Shared utility scripts
```

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind v4 + shadcn/ui + Recharts + Wouter
- **Backend**: Express 5 + TypeScript + Pino logging
- **Auth**: Clerk (Replit-managed, provisioned)
- **Database**: PostgreSQL + Drizzle ORM
- **API Contract**: OpenAPI 3.1 → Orval codegen (React Query hooks + Zod schemas)
- **Monorepo**: pnpm workspaces

## Key Features Built

### Authentication
- Clerk auth with custom branded sign-in/sign-up pages
- Proxy middleware on API server for session cookie auth
- requireAuth middleware on all protected routes
- No API token injection needed for web (cookie-based)

### Multi-tenant Data Model
- Organizations (agency/solo accounts, plan tiers)
- Org members with RBAC roles
- Clients (per org, with domain, industry, SEO score tracking)
- Audit jobs (async simulation, status polling)
- Audit issues (severity/category/priority scoring, approve/dismiss workflow)
- Reports (async generation, download URL)
- AI providers (OpenAI/Anthropic/Gemini/Ollama/custom, encrypted key storage)
- PageSpeed results (synthetic data, ready for real API integration)

### API Routes (`/api/`)
- `GET|PUT /auth/me`
- `GET|POST /organizations`, `GET|PUT|DELETE /organizations/:id`
- `GET|POST /organizations/:orgId/members`
- `GET|POST /clients`, `GET|PUT|DELETE /clients/:id`
- `GET|POST /audits`, `GET|DELETE /audits/:id`
- `GET /audits/:id/issues`
- `PUT /issues/:id/approve`, `PUT /issues/:id/dismiss`
- `GET|POST /reports`, `GET|DELETE /reports/:id`
- `GET /dashboard/stats`, `/dashboard/recent-audits`, `/dashboard/issue-breakdown`, `/dashboard/score-trends`
- `GET|POST /ai-providers`, `PUT|DELETE /ai-providers/:id`
- `GET /pagespeed/:auditId`

### Frontend Pages
- `/` — Public landing page
- `/sign-in`, `/sign-up` — Branded Clerk auth pages
- `/dashboard` — Stats cards, score trend chart, recent audits
- `/clients` — Client list with search
- `/clients/:id` — Client detail with audit history
- `/audits` — Audit job list with status filter
- `/audits/new` — New audit form
- `/audits/:id` — Audit detail with issue list + PageSpeed tab
- `/issues` — Global issue list with approve/dismiss
- `/reports` — Report list + generate dialog
- `/reports/:id` — Report detail with summary
- `/ai-providers` — AI provider config (OpenAI/Anthropic/Gemini/Ollama/custom)
- `/organizations` — Organization management
- `/settings` — User profile
- `/onboarding` — Multi-step wizard for new users

## Database Tables

- `users` — Clerk ID, email, role
- `organizations` — multi-tenant root, plan tiers
- `org_members` — user↔org membership with RBAC role
- `clients` — domain, industry, SEO score, last audit timestamp
- `audits` — URL, status, SEO score, crawl metadata
- `audit_issues` — severity, category, priority score, approval workflow
- `reports` — format, status, download URL, AI summary
- `ai_providers` — provider type, model, encrypted API key
- `page_speed_results` — Core Web Vitals

## Running the App

Both workflows must be running:
- `artifacts/api-server: API Server` — Express API on $PORT
- `artifacts/seorx: web` — Vite dev server on $PORT

## Codegen

To regenerate React Query hooks and Zod schemas after OpenAPI spec changes:
```bash
pnpm --filter @workspace/api-spec run codegen
```

## Database Migrations

To push schema changes to the database:
```bash
pnpm --filter @workspace/db run push
```

## Environment Variables (Auto-Provisioned)

- `DATABASE_URL` — PostgreSQL connection string
- `CLERK_PUBLISHABLE_KEY` — Clerk publishable key
- `CLERK_SECRET_KEY` — Clerk secret key
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key for Vite
- `SESSION_SECRET` — Session secret

## ROADMAP_STATUS.md

See `ROADMAP_STATUS.md` for detailed build phase tracking and deviation notes.

## Design Principles

- **Human approval gate**: All AI recommendations require explicit approve/dismiss before being surfaced to clients
- **Manual fallback paths**: Audit issues default to `status: "open"` — never auto-applied
- **Information density**: Dashboard and list views show max data at a glance
- **Teal/emerald accent**: SEO health color language (green = good, amber = warning, red = critical)
