# SEORx Build Roadmap Status

> Auto-maintained by the build process. Last updated: 2026-05-03

## Status Legend
- ✅ Complete
- 🔄 In Progress
- ⏳ Pending
- ❌ Blocked
- 📝 Deviated (see notes)

---

## Phase 1: Repository Initialization ✅
- [x] pnpm monorepo workspace initialized
- [x] TypeScript strict mode configured (tsconfig.base.json)
- [x] ESBuild production build configured
- [x] API server scaffold (Express 5 + Pino logging)
- [x] React + Vite frontend scaffold
- [x] Drizzle ORM + PostgreSQL configured
- [x] OpenAPI-first contract with Orval codegen

## Phase 2: Authentication & Security ✅
- [x] Clerk Auth provisioned (Replit-managed)
- [x] Clerk proxy middleware on API server
- [x] requireAuth middleware for all protected routes
- [x] API keys never hard-coded (all via env secrets)
- [x] SESSION_SECRET environment variable configured
- [x] Developer API bearer-token auth middleware

## Phase 3: Database Schema ✅
- [x] users table (clerkId, email, role RBAC)
- [x] organizations table (multi-tenant, plan tiers)
- [x] org_members table (RBAC roles per org)
- [x] clients table (domain, SEO score, audit tracking)
- [x] audits table (status, scores, crawl metadata)
- [x] audit_issues table (severity, category, priority scoring, approval workflow)
- [x] reports table (format, status, download URL)
- [x] ai_providers table (encrypted API keys, provider types)
- [x] page_speed_results table (Core Web Vitals, device type)
- [x] api_keys table (SHA-256 hash only, never plaintext)
- [x] DB schema pushed to development database

## Phase 4: API Server Routes ✅
- [x] GET/PUT /api/auth/me (user profile)
- [x] CRUD /api/organizations + members (RBAC-scoped)
- [x] CRUD /api/clients (org-scoped + plan limit enforcement)
- [x] CRUD /api/audits (org-scoped + plan limit enforcement + real crawler)
- [x] GET /api/audits/:id/issues (org-scoped, with filters)
- [x] PUT /api/issues/:id/approve + dismiss (RBAC + org-scoped)
- [x] CRUD /api/reports (RBAC-scoped, real PDF download)
- [x] GET /api/reports/:id/download (PDFKit streamed PDF)
- [x] GET /api/dashboard/* (all endpoints org-scoped)
- [x] CRUD /api/ai-providers (AES-256-GCM encrypted key storage)
- [x] GET /api/pagespeed/:auditId (RBAC-scoped, real API + fallback)
- [x] GET /api/billing/plans (public plan comparison)
- [x] POST /api/billing/checkout (Stripe checkout session)
- [x] POST /api/billing/portal (Stripe customer portal)
- [x] POST /api/billing/webhook (Stripe event handler)
- [x] CRUD /api/api-keys (developer API key management)
- [x] GET /api/integrations/gsc/connect (GSC OAuth initiation)
- [x] GET /api/integrations/gsc/callback (GSC OAuth callback)
- [x] GET /api/integrations/gsc/properties (GSC property list)
- [x] POST /api/integrations/gsc/analytics (GSC search analytics)
- [x] GET /api/integrations/webhooks (list registered webhooks)
- [x] POST /api/integrations/webhooks (register outbound webhook)
- [x] POST /api/integrations/webhooks/test (test webhook delivery)
- [x] GET /api/docs (Swagger UI)
- [x] GET /api/openapi.json (raw OpenAPI spec)
- [x] GET /api/developer/authorize (API key bearer-token auth)

## Phase 5: OpenAPI Spec & Codegen ✅
- [x] Comprehensive OpenAPI 3.1 spec (lib/api-spec/openapi.yaml)
- [x] Orval codegen → React Query hooks (lib/api-client-react)
- [x] Orval codegen → Zod validation schemas (lib/api-zod)
- [x] All schema names collision-free

## Phase 6: Frontend Build ✅
- [x] react-vite artifact scaffolded at "/"
- [x] Clerk client dependencies installed
- [x] Branded Clerk sign-in/sign-up pages
- [x] Landing page (public, branded)
- [x] Dashboard with stats + charts
- [x] Client management pages
- [x] Audit job pages (list, new, detail + PageSpeed tab)
- [x] Issue list with approve/dismiss (human workflow)
- [x] Report pages (list + generate + detail)
- [x] AI Provider configuration page
- [x] Onboarding wizard (multi-step)
- [x] Settings page
- [x] Organization management page

## Phase 7: SEO Scanner Engine ✅
- [x] Real multi-page crawler (cheerio + node-fetch, robots-parser)
- [x] robots.txt fetching and enforcement per-URL
- [x] Rate limiting safeguards (300ms between requests)
- [x] Max depth (4) and max pages controls
- [x] Full page analysis: title, meta, h1/h2, images, links, canonical, OG, structured data, viewport
- [x] 18+ issue detection rules across all 8 categories
- [x] Priority scoring algorithm (0–100 per issue)
- [x] SEO score calculation from real crawl findings
- [x] Graceful error handling

## Phase 8: AI Provider Adapters ✅
- [x] OpenAI adapter (configurable model)
- [x] Anthropic Claude adapter
- [x] Google Gemini adapter
- [x] Ollama local LLM adapter
- [x] Custom OpenAI-compatible endpoint
- [x] Batch AI recommendation generation (top 10 issues per audit)
- [x] Human approval gate preserved

## Phase 9: PageSpeed Integration ✅
- [x] Real PageSpeed Insights API v5 (activates when PAGESPEED_API_KEY set)
- [x] Synthetic fallback (no key required)
- [x] Mobile + desktop results stored separately

## Phase 10: Report Generation ✅
- [x] Real PDF export via PDFKit (branded, multi-page)
- [x] Executive summary generation
- [x] AI recommendations in PDF (approved issues only)
- [x] GET /api/reports/:id/download streams PDF directly

## Phase 11: Data Seeding ✅
- [x] 2 organizations, 4 clients, 5 audits, 8 issues, 3 AI providers

## Phase 12: RBAC ✅
- [x] loadUserContext middleware (preloads user + all org memberships per request)
- [x] requireAuth, requireOrgMember, requireOrgRole helpers
- [x] Org-scoped data isolation on all resource endpoints
- [x] assertClientAccess / assertAuditAccess for per-resource checks

## Phase 13: Stripe / License Enforcement ✅
- [x] Billing plan comparison endpoint (public)
- [x] Checkout session + customer portal + webhook handler
- [x] Webhook auto-upgrades/downgrades org plan in DB
- [x] enforceClientLimit middleware (POST /clients)
- [x] enforceAuditLimit middleware (POST /audits) — monthly counter per org
- [x] enforceAiLimit middleware — blocks AI recs on free plan
- [x] maxPages auto-clamped to plan limit on each audit

## Phase 14: Developer API ✅
- [x] api_keys table (SHA-256 hash, never plaintext, `srx_` prefix)
- [x] POST /api/api-keys — generate key (full key shown once)
- [x] GET /api/api-keys — list keys (prefix + metadata only)
- [x] DELETE /api/api-keys/:id — revoke key
- [x] PATCH /api/api-keys/:id — toggle active state
- [x] GET /api/docs — Swagger UI (custom SEORx branding)
- [x] GET /api/openapi.json — raw OpenAPI spec
- [x] GET /api/developer/authorize — bearer-token auth verification

## Phase 15: Security Hardening ✅
- [x] Helmet.js security headers (CSP, HSTS, X-Frame-Options)
- [x] CORS locked to ALLOWED_ORIGINS allowlist in production
- [x] Global rate limit: 500 req / 15 min
- [x] Audit rate limit: 20 audits / hour per user (IPv6-safe)
- [x] Webhook rate limit: 100 req / min
- [x] Body size limits (2 MB JSON, raw for Stripe)
- [x] Stripe webhook signature verification
- [x] AES-256-GCM encryption for AI provider API keys (lib/crypto.ts)
- [x] SHA-256 hashing for developer API keys (one-way)
- [x] Graceful base64 fallback with startup warning when ENCRYPTION_KEY not set

## Phase 16: Tests ⏳
- [ ] Unit tests for SEO scanner modules
- [ ] Integration tests for API routes
- [ ] E2E tests for audit flow

## Phase 17: Documentation ✅
- [x] ARCHITECTURE.md (full architecture reference)
- [x] API reference via Swagger UI at /api/docs
- [x] Deployment guide

## Phase 18: Integration Scaffolds ✅
- [x] Google Search Console OAuth flow (connect, callback, properties, analytics)
- [x] Outbound webhook registration (Zapier / Make / n8n compatible)
- [x] Webhook test delivery endpoint
- [x] Valid event types: audit.completed, issue.approved, issue.dismissed, report.ready

## Phase 19: Deployment Readiness ✅
- [x] PORT env var respected
- [x] BASE_PATH env var respected
- [x] No hard-coded secrets
- [x] Replit artifact.toml configured
- [x] Static frontend build (vite build)
- [x] Prod/dev environment separation via Clerk

---

## Deviations from original plan

| Phase | Deviation | Reason |
|-------|-----------|--------|
| 18 | GSC token storage not yet persisted (OAuth flow works, tokens not saved to DB) | Requires org_integrations table; deferred to next phase |
| 18 | Webhook registrations stored in-memory only | Requires org_webhooks table; deferred to next phase |

## Manual Fallback Paths (Preserved)
- Audit issues default to `status: "open"` pending human approval
- AI recommendations stored as `aiRecommendation` field — never auto-applied
- Reports require explicit creation (no auto-publish)
- All client-facing AI output gated by approve/dismiss workflow
- Stripe: all billing endpoints gracefully disabled when STRIPE_SECRET_KEY not set
- Encryption: falls back to base64 with startup warning when ENCRYPTION_KEY not set

## Completed Phases Summary
✅ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19
⏳ 16 (tests)

## Next Priority Actions
1. ⏳ Phase 16: Test suite (unit + integration)
2. ⏳ Phase 18 follow-up: Persist GSC tokens + webhook registrations to DB
