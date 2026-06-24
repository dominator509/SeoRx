# Codex Task Prompt — Build SEORx GEO/AEO AI Visibility Audit

You are working inside an existing hardened SEORx repository. Build a thorough, production-quality GEO/AEO report feature without weakening existing architecture, tests, security, or deployment assumptions.

## Mission

Add a new SEORx audit/report mode:

```txt
GEO / AEO AI Visibility Audit
Public promise: Get found in ChatGPT, Gemini, Perplexity, and Google AI Overviews.
Internal promise: Audit whether a business website is clear, crawlable, answer-ready, sourceable, and structured enough to be understood, cited, or recommended by AI answer engines.
```

This must be implemented as a first-class SEORx feature, not as a separate app, not as a separate database, and not as a parallel reporting system.

## Before editing any code

1. Read all repo-level coding-agent instructions, especially any `AGENTS.md` files. Obey the most specific applicable instructions.
2. Inspect the actual repository structure. Do not assume the exact paths below exist; adapt to the repo's established conventions.
3. Read the existing architecture, roadmap, security, scanner, report, AI-provider, and database docs if present:
   - `README.md`
   - `ARCHITECTURE.md`
   - `BUILD_ROADMAP.md`
   - `SECURITY.md`
   - `docs/scanners.md`
   - `docs/reports.md`
   - `docs/ai-providers.md`
   - `docs/issue-scoring.md`
   - `prisma/schema.prisma`
   - existing audit/report/scanner/AI service files
4. Inspect `package.json` scripts and use the repo's actual commands for typecheck, lint, test, migrations, and build.
5. Create or update an implementation note at `docs/geo-aeo/IMPLEMENTATION_NOTES.md` containing:
   - What existing patterns you found.
   - Which files/services you will extend.
   - Which test commands exist.
   - Any assumptions you must make.

Do not ask for clarification unless the repository is unusable. Make the safest small assumption, document it, and proceed.

## Hard boundaries

Do not do any of the following:

- Do not create a new Next.js app.
- Do not replace the existing ORM, database, auth, RBAC, scanner registry, report engine, queue system, AI provider registry, or export system.
- Do not bypass server-side tenant, organization, client, project, audit, report, or license access checks.
- Do not make client-facing AI output visible without approval.
- Do not make real paid API calls in tests.
- Do not require real OpenAI, Google, Perplexity, Gemini, SERP, DataForSEO, SerpAPI, or Stripe keys for tests.
- Do not automate prohibited scraping or queries against Google Search, Google AI Overviews, Google AI Mode, ChatGPT, Gemini, Perplexity, Copilot, Claude, or similar platforms.
- Do not store raw platform answers, screenshots, credentials, tokens, or secrets insecurely.
- Do not log secrets, full prompts containing credentials, API keys, cookies, OAuth tokens, auth headers, or webhook secrets.
- Do not claim guaranteed rankings, guaranteed citations, guaranteed AI Overview placement, guaranteed traffic, guaranteed revenue, or guaranteed leads.
- Do not hard-code current market-size claims or temporal marketing stats into product logic.
- Do not treat `llms.txt` as a Google AI Overviews ranking requirement. If added, make it an optional non-Google/general ecosystem observation only.

## Required feature flags

Add these in the repo's established environment/config style. If the repo has a feature flag table/service, use it. Otherwise add env-backed config with validation.

```env
GEO_AEO_ENABLED=true
GEO_AEO_REAL_PLATFORM_CHECKS=false
GEO_AEO_MANUAL_OBSERVATIONS=true
GEO_AEO_DEFAULT_PROMPT_COUNT=25
GEO_AEO_MAX_COMPETITORS=5
GEO_AEO_MAX_PAGES_BASIC=5
GEO_AEO_MAX_PAGES_STANDARD=10
GEO_AEO_MAX_PAGES_PREMIUM=25
```

Behavior:

- `GEO_AEO_ENABLED=false` hides or disables the module server-side.
- `GEO_AEO_REAL_PLATFORM_CHECKS=false` means no live AI-search platform checks are performed. The MVP must still work using crawl data, manual observations, and simulated citability/readiness scoring.
- `GEO_AEO_MANUAL_OBSERVATIONS=true` allows admin-entered observations from AI tools or screenshots/notes.
- Package limit flags control Fiverr-style scope.

## New product concepts

Add the following concepts using the repo's existing enum/type style.

Audit/report types:

```txt
AuditType.GEO_AEO
AuditType.HYBRID
ReportType.GEO_AEO_AUDIT
```

AI visibility surfaces:

```txt
CHATGPT
GEMINI
PERPLEXITY
GOOGLE_AI_OVERVIEWS
GOOGLE_AI_MODE
COPILOT
CLAUDE
MANUAL_OBSERVATION
SIMULATED_RETRIEVAL
```

Prompt intents:

```txt
DISCOVERY
LOCAL_SERVICE
COMPARISON
BEST_PROVIDER
PRICING
PROBLEM_SOLUTION
FAQ
ALTERNATIVE
TRUST_VALIDATION
```

Fiverr package tiers:

```txt
BASIC_AI_VISIBILITY_SNAPSHOT
STANDARD_GEO_AEO_COMPETITOR_GAP
PREMIUM_FULL_AI_VISIBILITY_ROADMAP
```

## Required database/data model work

Use the repo's current Prisma conventions, audit/project/client/org relationships, timestamps, indexes, and cascade behavior. Add migrations. Preserve existing data.

Prefer normalized models if the repo is ready for them. If the existing app strongly favors JSON payloads for early features, add minimal JSON fields now and create TODOs for normalization. Do not overfit; keep the app runnable.

Recommended models:

```prisma
enum AiVisibilitySurface {
  CHATGPT
  GEMINI
  PERPLEXITY
  GOOGLE_AI_OVERVIEWS
  GOOGLE_AI_MODE
  COPILOT
  CLAUDE
  MANUAL_OBSERVATION
  SIMULATED_RETRIEVAL
}

enum GeoPromptIntent {
  DISCOVERY
  LOCAL_SERVICE
  COMPARISON
  BEST_PROVIDER
  PRICING
  PROBLEM_SOLUTION
  FAQ
  ALTERNATIVE
  TRUST_VALIDATION
}

model GeoAuditProfile {
  id             String   @id @default(cuid())
  auditRunId      String   @unique
  businessName    String
  websiteUrl      String
  targetLocations Json?
  targetServices  Json?
  targetCustomers Json?
  competitorsJson Json?
  uniqueProofJson Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model GeoPrompt {
  id             String          @id @default(cuid())
  auditRunId      String
  promptText      String
  intent          GeoPromptIntent
  targetService   String?
  targetLocation  String?
  buyerStage      String?
  priority        Int             @default(50)
  createdAt       DateTime        @default(now())
}

model GeoVisibilityObservation {
  id                       String              @id @default(cuid())
  auditRunId                String
  promptId                  String?
  surface                   AiVisibilitySurface
  observedAt                DateTime            @default(now())
  brandMentioned            Boolean             @default(false)
  brandCited                Boolean             @default(false)
  brandPosition             Int?
  sentiment                 String?
  answerSummary             String?
  citedUrlsJson             Json?
  competitorsMentionedJson  Json?
  rawAnswerExcerpt          String?
  confidenceScore           Int                 @default(50)
  observationMode           String              @default("MANUAL")
}

model GeoPageAssessment {
  id                     String   @id @default(cuid())
  auditRunId              String
  pageUrl                 String
  aiCitableScore          Int
  answerCoverageScore     Int
  entityClarityScore      Int
  proofSignalScore        Int
  structureScore          Int
  schemaReadinessScore    Int
  citationReadinessScore  Int
  detectedGapsJson        Json?
  recommendedFixesJson    Json?
  createdAt               DateTime @default(now())
}

model GeoRecommendation {
  id                 String   @id @default(cuid())
  auditRunId          String
  pageUrl             String?
  category            String
  title               String
  evidence            String
  recommendation      String
  priorityScore       Int
  estimatedEffort     String?
  owner               String?
  fiverrPackageTier   String?
  status              String   @default("DRAFT")
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

Adapt names and relations to the existing schema. Add indexes on `auditRunId`, `promptId`, `surface`, `pageUrl`, and any tenant/org/project foreign keys used by the repo.

## Required issue types

Add these to the repo's canonical issue-type system, with mappings to category, default severity, evidence schema, scoring defaults, and report wording:

```ts
AI_VISIBILITY_ZERO_BASELINE
WEAK_ENTITY_DEFINITION
UNCLEAR_SERVICE_POSITIONING
MISSING_DIRECT_ANSWER_BLOCKS
WEAK_FAQ_COVERAGE
MISSING_SCHEMA_FOR_AI_CONTEXT
WEAK_SOURCEABLE_CLAIMS
NO_PROOF_OR_CASE_STUDIES
COMPETITOR_OWNS_AI_PROMPT
MISSING_COMPARISON_CONTENT
MISSING_SERVICE_PAGE
MISSING_LOCATION_PAGE
INCONSISTENT_BRAND_ENTITY
LOW_EXTERNAL_CITATION_COVERAGE
AI_CRAWLABILITY_RISK
GENERIC_COMMODITY_CONTENT
WEAK_AUTHOR_OR_ORGANIZATION_TRUST
MISSING_REVIEW_OR_TESTIMONIAL_PROOF
MISSING_SAME_AS_OR_ENTITY_LINKS
PROMPT_INTENT_GAP
```

Every issue must include:

```txt
category
issue type
title
plain-English description
evidence
page URL when applicable
AI visibility impact
business impact
recommended fix
estimated effort
recommended owner
priority score
approval status
```

## Required scanners

Use the existing scanner registry and scanner output contract. Add GEO/AEO scanners under the repo's scanner structure, likely one of:

```txt
server/scanners/geo/
server/scanners/geo-aeo/
server/scanners/
```

Required scanners:

```txt
ai-answer-coverage.scanner.ts
entity-clarity.scanner.ts
ai-citable-content.scanner.ts
sourceable-claims.scanner.ts
geo-schema-readiness.scanner.ts
competitor-answer-gap.scanner.ts
citation-readiness.scanner.ts
ai-crawlability.scanner.ts
service-page-gap.scanner.ts
geo-scoring.scanner.ts
```

Scanner behavior:

- Must use crawled page data, parsed HTML, existing metadata, internal links, headings, extracted text, schema, CTAs, trust signals, and business profile intake.
- Must produce deterministic evidence-backed issue candidates.
- Must not ask AI to invent scanner findings.
- Must deduplicate findings against existing SEO issue types where appropriate.
- Must fail gracefully per page and not crash the whole audit.
- Must sanitize evidence before client display.

## Required scoring system

Add a separate `AI Visibility Score` from the standard SEO health score.

Default weighted scoring:

```txt
20% AI answer coverage
15% Entity clarity
15% AI-citable page structure
15% Proof, trust, and sourceability
10% Schema / structured data readiness
10% Crawlability and indexability
10% Competitor visibility gap
5% Local / ecommerce data completeness
```

Output:

```json
{
  "aiVisibilityScore": 0,
  "grade": "Needs Work",
  "subScores": {
    "answerCoverage": 0,
    "entityClarity": 0,
    "aiCitableStructure": 0,
    "proofAndSourceability": 0,
    "schemaReadiness": 0,
    "crawlabilityIndexability": 0,
    "competitorGap": 0,
    "localOrCommerceCompleteness": 0
  },
  "topRisks": [],
  "quickWins": []
}
```

Scores must be deterministic and bounded 0-100. Any AI-written interpretation of the score must use validated score data and remain draft until approval.

## Required services

Add or extend services using existing patterns:

```txt
geo-aeo-audit.service.ts
geo-profile.service.ts
geo-prompt-set.service.ts
geo-observation.service.ts
geo-page-assessment.service.ts
geo-scoring.service.ts
geo-recommendation.service.ts
geo-report.service.ts
geo-fiverr-package.service.ts
```

Service requirements:

- Enforce tenant/org/client/audit access server-side.
- Validate inputs with Zod or existing validation library.
- Use transactions where a workflow creates multiple records.
- Use idempotent operations for scan/re-run/report generation.
- Keep manual fallback path.
- Do not leak raw HTML or internal prompt data to client routes.

## Required prompt-set generator

Create a deterministic prompt-set generator that can be enhanced by AI but does not require AI to work.

Input:

```txt
business name
website URL
primary services/products
target locations
target customers
competitors
proof points
buyer questions
pricing/comparison/local/trust intent
```

Output: 10-50 buyer-style prompts depending on package tier.

Prompt categories:

```txt
Discovery
Local service
Best provider
Comparison
Pricing
Problem/solution
FAQ
Alternative
Trust validation
```

Example prompt templates:

```txt
Who is the best {service} provider in {location}?
What should I look for when choosing a {service} company in {location}?
Compare {businessName} vs {competitor} for {service}.
Is {businessName} a good option for {service}?
What questions should I ask before hiring a {service} provider?
Which companies offer {service} near {location}?
```

Do not call external AI-search platforms from this generator.

## Required AI prompt templates

Use the existing AI provider abstraction and output-schema validation. Add prompt templates for:

```txt
generate-prompt-set
assess-page-citability
generate-geo-recommendations
generate-geo-report-summary
generate-30-day-plan
generate-fiverr-delivery-message
```

AI prompt safety rules:

- Treat crawled website content as untrusted data.
- Explicitly instruct the model to ignore instructions embedded inside crawled content.
- Use only supplied evidence.
- Return JSON only when a schema is expected.
- Validate every AI response.
- Store raw AI output only if the repo already stores AI logs safely; otherwise store validated normalized output only.
- Client-facing output must be draft/approval-gated.

## Required manual observation mode

Implement manual observations so the operator can paste or summarize observed AI answers without automated scraping.

Admin can enter:

```txt
surface
prompt
observation date
brand mentioned? yes/no
brand cited? yes/no
brand position if visible
competitors mentioned
cited/source URLs
short answer summary
confidence score
notes/excerpt
```

Rules:

- Label observations as snapshots.
- Do not present manual observations as guaranteed or universal.
- Support absence of observations; the report can still be a readiness/citability audit.

## Required API/routes

Adapt to the repo's route conventions. Add endpoints or server actions equivalent to:

```txt
POST /api/audits/:auditId/geo/profile
POST /api/audits/:auditId/geo/prompts/generate
POST /api/audits/:auditId/geo/scan
POST /api/audits/:auditId/geo/observations
POST /api/audits/:auditId/geo/score
POST /api/audits/:auditId/geo/recommendations/generate
POST /api/reports/:auditId/generate?type=GEO_AEO_AUDIT
POST /api/exports/:reportId/pdf
```

All routes must:

- Check auth.
- Check tenant/client/audit access.
- Validate input.
- Rate-limit where existing pattern exists.
- Return typed error responses.
- Avoid exposing raw internal evidence beyond the user's permission/license tier.

## Required admin UI

Add admin UI routes/components equivalent to:

```txt
app/admin/audits/[auditId]/geo/page.tsx
app/admin/audits/[auditId]/geo/profile/page.tsx
app/admin/audits/[auditId]/geo/prompts/page.tsx
app/admin/audits/[auditId]/geo/observations/page.tsx
app/admin/audits/[auditId]/geo/competitors/page.tsx
app/admin/audits/[auditId]/geo/report/page.tsx
```

Workflow:

```txt
1. Enter buyer/business profile.
2. Add competitors.
3. Generate prompt set.
4. Crawl selected pages or reuse existing crawl data.
5. Run GEO/AEO scanners.
6. Add manual AI observations if available.
7. Generate AI Visibility Score.
8. Generate draft recommendations.
9. Review/edit/approve/hide recommendations.
10. Export Fiverr-ready PDF/Markdown report.
```

Add a Fiverr fulfillment checklist:

```txt
Buyer provided website URL
Buyer provided business name
Buyer provided target service/product
Buyer provided target location
Buyer provided 2-5 competitors
Prompt set generated
Website crawled or imported
Top pages reviewed
AI visibility score generated
Manual observations added or skipped
Report recommendations approved
PDF/Markdown exported
Delivery message generated
Upsell offer generated
```

Keep UI boring and functional. Do not spend excessive time on animations or visual polish.

## Required client UI

If the client dashboard exists, add a gated AI Visibility section:

```txt
client/ai-visibility/page.tsx
```

Show only approved data and license-permitted sections:

```txt
AI Visibility Score
Top approved quick wins
Approved prompt coverage summary
Approved page opportunities
Approved 30-day plan
Latest approved report download
Upgrade/implementation CTA
```

If client dashboard is not ready or license gating is complex, create a server-side-gated placeholder that links to the approved report only.

## Required report template

Add a canonical GEO/AEO report template that supports PDF and Markdown exports through the existing export system. Do not duplicate report logic between PDF and Markdown.

Sections:

```txt
1. Cover Page
2. Executive Summary
3. What This Audit Measures
4. AI Visibility Score
5. Prompt Set Generated/Tested
6. Baseline AI Visibility Observations
7. Competitor Comparison
8. Page-by-Page AI-Citability Review
9. Top GEO/AEO Issues
10. FAQ and Schema Fixes
11. AI-Citable Service Page Recommendations
12. Citation and Source Recommendations
13. 30-Day Action Plan
14. Optional Next Steps / Upsell
15. Disclaimer
```

Mandatory disclaimer language:

```txt
AI-generated answers vary by model, location, prompt wording, date, personalization, available sources, and index freshness. This audit identifies practical improvements that may make the business easier for search engines and AI answer systems to understand, summarize, cite, and recommend. It does not guarantee rankings, traffic, leads, revenue, AI citations, or placement in Google AI Overviews, AI Mode, ChatGPT, Gemini, Perplexity, or any other system.
```

## Required Fiverr package logic

Add package presets in config/constants using existing offer/licensing conventions:

```ts
const GEO_AEO_FIVERR_PACKAGES = {
  basic: {
    name: "AI Visibility Snapshot",
    pages: 5,
    prompts: 10,
    competitors: 2,
    includes: [
      "AI visibility score",
      "Top GEO/AEO blockers",
      "Basic prompt set",
      "PDF or Markdown report",
      "30-day quick-win plan"
    ]
  },
  standard: {
    name: "GEO/AEO Audit + Competitor Gap",
    pages: 10,
    prompts: 25,
    competitors: 3,
    includes: [
      "Everything in Basic",
      "Competitor comparison",
      "FAQ/schema recommendations",
      "AI-citable page recommendations",
      "Priority fix list"
    ]
  },
  premium: {
    name: "Full AI Visibility Roadmap",
    pages: 25,
    prompts: 50,
    competitors: 5,
    includes: [
      "Everything in Standard",
      "Service page outlines",
      "Citation/source roadmap",
      "Developer-ready task list",
      "Implementation plan",
      "Monthly monitoring proposal"
    ]
  }
};
```

Do not hard-code prices into core logic unless the repo has offer pricing config. Prices belong in config/admin editable areas.

## Required exports

Support at least:

```txt
PDF report, if existing PDF export is ready
Markdown report
Fiverr delivery message text
Developer task list, if existing task export system is ready
```

If PDF export is not available or flaky, implement Markdown first and add PDF via the repo's existing PDF adapter or a clear scaffold that does not break builds.

## Required tests

Use actual repo commands. Add or update tests covering:

```txt
unit: GEO/AEO scoring
unit: prompt-set generator
unit: each new scanner
unit: output schemas
integration: GEO/AEO profile creation
integration: prompt generation
integration: scan + assessment generation
integration: manual observations
integration: report generation
integration: export payload
security: tenant/audit access checks
security: no client visibility for draft output
security: no real external calls in tests
migration: schema migration applies cleanly
```

Run the strongest applicable set:

```bash
npm run typecheck
npm run lint
npm run test -- geo
npm run test:unit -- geo
npm run test:integration -- geo
npm run test:security -- geo
npm run build
```

If scripts differ, use the closest existing scripts. If a script is missing, document it in `IMPLEMENTATION_NOTES.md` and final response.

## Build roadmap for this task

Implement in this order. Do not jump to UI polish before backend/domain tests pass.

### Phase 0 — Reconnaissance and plan

- Read repo instructions and architecture.
- Identify existing audit, scanner, report, AI, export, approval, auth, RBAC, and Prisma patterns.
- Write `docs/geo-aeo/IMPLEMENTATION_NOTES.md`.
- Confirm test/build scripts.

Exit criteria:

- You know where to add enums, types, services, routes, and tests.
- You have not changed product behavior yet except docs.

### Phase 1 — Types, config, database, constants

- Add feature flags/config validation.
- Add audit/report enum values.
- Add GEO/AEO shared types and Zod schemas.
- Add Prisma models or minimal JSON fields.
- Add migration.
- Add issue types and package presets.

Exit criteria:

- Typecheck passes or only fails on upcoming intentionally referenced files.
- Migration generated and applies in test/dev workflow.

### Phase 2 — Domain services

- Implement profile service.
- Implement Fiverr package service.
- Implement prompt-set generator.
- Implement manual observation service.
- Implement scoring service.
- Add unit tests.

Exit criteria:

- Domain services work without external API calls.
- Unit tests pass.

### Phase 3 — Scanners and issue generation

- Add GEO/AEO scanners.
- Register them only for `GEO_AEO` and `HYBRID` audit modes, or behind feature flag.
- Convert findings to normalized issue candidates.
- Add scanner fixtures and tests.

Exit criteria:

- Scanner registry runs existing scanners unchanged.
- GEO/AEO scanners produce deterministic evidence-backed findings.

### Phase 4 — AI-assisted drafts through existing provider abstraction

- Add prompt templates and output schemas.
- Use existing AI provider registry and mock adapter.
- Add draft recommendations/report summaries/30-day plan.
- Require approval before client/report visibility.
- Add prompt-injection guardrails.

Exit criteria:

- Mock AI can generate valid drafts.
- Invalid AI output is rejected gracefully.
- No real provider keys required.

### Phase 5 — Report and export

- Add canonical `GEO_AEO_AUDIT` report builder.
- Generate report from approved canonical data.
- Add PDF/Markdown export support using existing adapters.
- Add Fiverr delivery message generator.

Exit criteria:

- Report excludes hidden/draft issues.
- Markdown export works.
- PDF works if existing PDF adapter is available.

### Phase 6 — API/server actions

- Add server routes/actions for profile, prompts, scan, observations, score, recommendations, report generation, and export.
- Enforce access checks, validation, rate limits, and safe errors.

Exit criteria:

- API integration tests pass.
- Cross-tenant access is blocked.

### Phase 7 — Admin UI and optional client UI

- Add audit type selector or GEO/AEO tab in existing audit flow.
- Add intake/profile, prompts, observations, competitor, score, recommendations, report/export pages.
- Add fulfillment checklist.
- Add client AI visibility page only if license/access patterns are clear.

Exit criteria:

- Admin can complete the workflow manually.
- Client sees only approved/gated data.

### Phase 8 — QA, docs, seed/demo data

- Add docs under `docs/geo-aeo/`.
- Add seed/demo audit if the repo has demo data patterns.
- Run typecheck/lint/tests/build.
- Fix failures without weakening tests.
- Update final implementation notes.

Exit criteria:

- Existing features still pass tests.
- New GEO/AEO happy path is covered.

## Anti-deadlock rules

- If a path/name differs from this prompt, adapt to the repo's existing convention.
- If a script is missing, use the closest script and document the gap.
- If a type or model is difficult to normalize safely, use a JSON-backed MVP field and document a normalization follow-up.
- If PDF export is unstable, implement canonical report payload + Markdown export first, then scaffold PDF through the existing adapter without breaking build.
- If live platform observation is not legally/compliantly available, use manual observation + simulated citability only.
- If a feature is too large to finish in one pass, leave the app runnable and complete the backend/report path before UI polish.
- Never spin indefinitely on styling, naming, or broad refactors.

## Anti-fixation rules

Prioritize in this order:

1. Data model and feature flags.
2. Deterministic services and scanners.
3. Report payload correctness.
4. Approval and access control.
5. Tests.
6. Minimal usable UI.
7. Visual polish.

Do not spend more effort on UI polish than on scanner evidence, approval gating, and report correctness.

## Definition of done

This task is complete when:

- `GEO_AEO` can be selected as an audit/report mode.
- Admin can enter business intake and competitors.
- System can generate a prompt set.
- System can run GEO/AEO scanners on crawled or fixture pages.
- System can generate an AI Visibility Score.
- Admin can add manual AI observations.
- System can generate draft recommendations and a 30-day plan.
- Drafts require approval before report/client visibility.
- System can generate a Fiverr-ready GEO/AEO report payload.
- Markdown export works; PDF works if existing export adapter supports it.
- Feature flags can disable the module.
- Tests cover domain logic, scanner outputs, report generation, access checks, and no-real-external-calls behavior.
- Typecheck, lint, and the relevant test/build commands pass or documented non-feature pre-existing failures exist.

## Final response format

When finished, respond with:

```txt
Summary
- What was built.
- Where the main files are.
- How the workflow works.

Tests run
- Exact commands and pass/fail results.

Migrations
- Migration name/file and whether it applied.

Feature flags/env
- New flags and defaults.

Security/approval notes
- How draft output, access checks, and external calls are handled.

Known limitations
- Anything intentionally scaffolded or deferred.

Next recommended task
- One concise next task.
```
