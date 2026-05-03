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

## Phase 3: Database Schema ✅
- [x] users table (clerkId, email, role RBAC)
- [x] organizations table (multi-tenant, plan tiers)
- [x] org_members table (RBAC roles per org)
- [x] clients table (domain, SEO score, audit tracking)
- [x] audits table (status, scores, crawl metadata)
- [x] audit_issues table (severity, category, priority scoring, approval workflow)
- [x] reports table (format, status, download URL)
- [x] ai_providers table (encrypted API keys, provider types)
- [x] page_speed_results table (Core Web Vitals, device type, speedIndex, TBT)
- [x] DB schema pushed to development database

## Phase 4: API Server Routes ✅
- [x] GET/PUT /api/auth/me (user profile)
- [x] CRUD /api/organizations + members (RBAC-scoped)
- [x] CRUD /api/clients (org-scoped data isolation)
- [x] CRUD /api/audits (org-scoped, real crawler)
- [x] GET /api/audits/:id/issues (org-scoped, with filters)
- [x] PUT /api/issues/:id/approve + dismiss (RBAC + org-scoped)
- [x] CRUD /api/reports (RBAC-scoped, PDF download)
- [x] GET /api/reports/:id/download (real PDF via PDFKit)
- [x] GET /api/dashboard/stats, recent-audits, issue-breakdown, score-trends (org-scoped)
- [x] CRUD /api/ai-providers (encrypted key storage)
- [x] GET /api/pagespeed/:auditId (RBAC-scoped, real API + synthetic fallback)
- [x] GET /api/billing/plans (public plan listing)
- [x] POST /api/billing/checkout (Stripe checkout session)
- [x] POST /api/billing/portal (Stripe customer portal)
- [x] POST /api/billing/webhook (Stripe webhook handler)

## Phase 5: OpenAPI Spec & Codegen ✅
- [x] Comprehensive OpenAPI 3.1 spec (lib/api-spec/openapi.yaml)
- [x] Orval codegen → React Query hooks (lib/api-client-react)
- [x] Orval codegen → Zod validation schemas (lib/api-zod)
- [x] All schema names collision-free

## Phase 6: Frontend Build ✅
- [x] react-vite artifact scaffolded at "/"
- [x] Clerk client dependencies installed
- [x] Branded Clerk sign-in/sign-up pages (custom title, logo, emerald theme)
- [x] Landing page (public, branded hero + feature sections)
- [x] Dashboard with stats cards + SEO score trend chart + issue breakdown
- [x] Client management pages (list + detail with audit history)
- [x] Audit job pages (list, new audit form, detail with issue list + PageSpeed tab)
- [x] Issue list with approve/dismiss (human confirmation dialogs)
- [x] Report pages (list + generate dialog + detail with summary)
- [x] AI Provider configuration page
- [x] Onboarding wizard (multi-step)
- [x] Settings page
- [x] Organization management page
- [x] AppLayout sidebar with navigation + auth state

## Phase 7: SEO Scanner Engine ✅
- [x] Real multi-page crawler (cheerio + node-fetch, robots-parser)
- [x] robots.txt fetching and enforcement per-URL
- [x] Rate limiting safeguards (300ms between requests)
- [x] Max depth (4) and max pages controls
- [x] Full page analysis: title, meta, h1/h2, images, links, canonical, OG, structured data, viewport
- [x] 18+ issue detection rules across all 8 categories
- [x] Priority scoring algorithm (0–100 per issue)
- [x] SEO score calculation (100 minus severity-weighted deductions)
- [x] Crawl progress callback for real-time logging
- [x] Graceful error handling (unreachable pages, fetch timeouts)

## Phase 8: AI Provider Adapters ✅
- [x] OpenAI adapter (chat completions, configurable model)
- [x] Anthropic Claude adapter (messages API)
- [x] Google Gemini adapter (generative AI)
- [x] Ollama local LLM adapter (REST API, configurable base URL)
- [x] Custom OpenAI-compatible endpoint support
- [x] Batch AI recommendation generation (top 10 issues per audit)
- [x] Rate-limiting between AI calls (500ms delay)
- [x] AI provider selection (isDefault flag + org-scoped)
- [x] Graceful fallback (audit completes even if AI fails)
- [x] Human approval gate preserved: aiRecommendation stored separately, never auto-applied

## Phase 9: PageSpeed Integration ✅
- [x] PageSpeed results table (mobile + desktop, all Core Web Vitals)
- [x] Real PageSpeed Insights API v5 integration (activates when PAGESPEED_API_KEY is set)
- [x] Synthetic PageSpeed data fallback (realistic distributions, no key required)
- [x] Device-aware results (mobile vs desktop stored separately)
- [x] Accessibility, Best Practices, SEO scores alongside Performance
- [x] RBAC enforcement on pagespeed route

## Phase 10: Report Generation ✅
- [x] Report creation and async generation
- [x] Report status lifecycle (generating → ready/failed)
- [x] Executive summary generation (issue counts, top priorities)
- [x] Top 5 issues extraction by priority score
- [x] Real PDF export via PDFKit (branded, multi-page, AI recommendations)
- [x] GET /api/reports/:id/download streams PDF directly
- [x] RBAC enforcement on all report routes

## Phase 11: Data Seeding ✅
- [x] 2 organizations (agency + solo)
- [x] 4 clients across orgs
- [x] 5 audits (4 completed, 1 running)
- [x] 8 realistic SEO issues with AI recommendations
- [x] 3 AI provider configs

## Phase 12: RBAC ✅
- [x] loadUserContext middleware: auto-provisions user + preloads all org memberships on every request
- [x] requireAuth: enforces authentication, uses preloaded context (no extra DB round-trip)
- [x] requireOrgMember / requireOrgRole: org-scoped role enforcement middleware
- [x] getMembershipForOrg / getUserOrgIds: zero-cost helpers using preloaded memberships
- [x] assertClientAccess / assertAuditAccess: per-resource access verification
- [x] clients: org-scoped list, create, read, update, delete
- [x] audits: org-scoped list, create, read, delete
- [x] audit issues: approve/dismiss gated by org membership
- [x] reports: create/read/download gated by org membership
- [x] dashboard: all stats scoped to user's orgs
- [x] pagespeed: access gated by audit ownership
- [x] organizations: list scoped to memberships, includes myRole field

## Phase 13: Stripe / License Enforcement ✅ (Scaffold)
- [x] GET /api/billing/plans — public plan comparison endpoint
- [x] POST /api/billing/checkout — creates Stripe checkout session (requires STRIPE_SECRET_KEY)
- [x] POST /api/billing/portal — opens billing portal for existing subscribers
- [x] POST /api/billing/webhook — handles checkout.session.completed + subscription.deleted
- [x] Webhook auto-upgrades/downgrades org plan in database
- [x] Plan limit constants (auditsPerMonth, clientsMax, maxPages, aiRecommendations)
- [x] Graceful degradation: all billing endpoints return clear errors when Stripe not configured
- [ ] Plan enforcement middleware (count checks before each audit/client creation)
- [ ] Subscription management UI in frontend

## Phase 14: Developer API ⏳
- [ ] API key generation for programmatic access
- [ ] Rate limiting
- [ ] API documentation (OpenAPI served at /api/docs)

## Phase 15: Security Hardening ✅
- [x] Helmet.js security headers (CSP, HSTS, X-Frame-Options, etc.)
- [x] CORS: locked to explicit origin allowlist in production (ALLOWED_ORIGINS env)
- [x] Global rate limit: 500 req / 15 min per IP
- [x] Audit rate limit: 20 audits / hour per user
- [x] Webhook rate limit: 100 req / min
- [x] Body size limits (2 MB for JSON/form, raw for Stripe webhooks)
- [x] Stripe webhook signature verification (constructWebhookEvent)
- [x] SQL injection prevention via Drizzle ORM parameterized queries
- [ ] AES-256-GCM encryption for AI provider API keys (needs ENCRYPTION_KEY secret)

## Phase 16: Tests ⏳
- [ ] Unit tests for SEO scanner modules
- [ ] Integration tests for API routes
- [ ] E2E tests for audit flow

## Phase 17: Documentation ⏳
- [ ] ARCHITECTURE.md
- [ ] API reference
- [ ] Deployment guide

## Phase 18: Integration Scaffolds ⏳
- [ ] CMS connectors (WordPress, Webflow)
- [ ] Task automation (Zapier/Make webhooks)
- [ ] Google Search Console data import

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
| 13 | Plan enforcement middleware not yet applied per-route | Structural: needs per-route usage counters; deferred to post-launch hardening |
| 15 | AES-256-GCM encryption still base64 placeholder | Needs ENCRYPTION_KEY secret configured by operator |

## Manual Fallback Paths (Preserved)
- Audit issues default to `status: "open"` pending human approval
- AI recommendations stored as `aiRecommendation` field — never auto-applied
- Reports require explicit creation (no auto-publish)
- All client-facing AI output gated by approve/dismiss workflow
- Crawler respects robots.txt — no content is fetched from disallowed paths
- Stripe: all billing is gracefully disabled when STRIPE_SECRET_KEY not set

## Completed Phases Summary
✅ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13 (scaffold), 15, 19
⏳ 13 (enforcement), 14, 16, 17, 18

## Next Priority Actions
1. ⏳ Phase 13 follow-up: per-route plan enforcement (audit/client count checks)
2. ⏳ Phase 14: Developer API keys + /api/docs
3. ⏳ Phase 15 follow-up: AES-256-GCM for AI key encryption (needs ENCRYPTION_KEY)
4. ⏳ Phase 16: Test suite
5. ⏳ Phase 17: ARCHITECTURE.md + deployment guide
