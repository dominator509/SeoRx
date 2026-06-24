# GEO/AEO Build Roadmap for SEORx

This roadmap is intentionally narrow. It adds one new SEORx report mode without refactoring the entire app.

## Phase 0 — Repo reconnaissance

Goal: understand the hardened repo before editing.

Tasks:

- Read `AGENTS.md` and nested agent instructions.
- Inspect audit, scanner, issue, scoring, AI, report, export, approval, RBAC, and Prisma patterns.
- Inspect `package.json` scripts.
- Inspect existing docs and tests.
- Create `docs/geo-aeo/IMPLEMENTATION_NOTES.md`.

Acceptance criteria:

- Current repo patterns are documented.
- Existing commands are documented.
- No product behavior changed yet.

## Phase 1 — Feature flags, constants, types, database

Goal: add foundations without changing existing audit behavior.

Tasks:

- Add `GEO_AEO_ENABLED` and related config.
- Add audit/report enum values.
- Add shared types and Zod schemas.
- Add Prisma models or JSON-backed MVP fields.
- Add migration.
- Add issue types.
- Add Fiverr package presets.

Acceptance criteria:

- Existing audits still work.
- Feature disabled path works.
- Migration applies cleanly.
- Typecheck passes.

## Phase 2 — GEO/AEO domain services

Goal: build deterministic backend logic that works without real external API calls.

Services:

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

Tasks:

- Create profile/intake create/update/read.
- Implement package limits.
- Implement deterministic prompt-set generator.
- Implement manual observation CRUD.
- Implement scoring service.
- Implement recommendation normalization.
- Add unit tests.

Acceptance criteria:

- Services enforce access checks.
- Services validate input.
- Prompt generator works without AI.
- Scoring is deterministic and bounded.

## Phase 3 — GEO/AEO scanners

Goal: add evidence-backed issue detection.

Scanners:

```txt
ai-answer-coverage
entity-clarity
ai-citable-content
sourceable-claims
geo-schema-readiness
competitor-answer-gap
citation-readiness
ai-crawlability
service-page-gap
geo-scoring
```

Tasks:

- Add scanner files using existing scanner contract.
- Register only for GEO/AEO or Hybrid audits.
- Use crawl data and intake data.
- Deduplicate issues.
- Add fixtures.
- Add scanner tests.

Acceptance criteria:

- Scanner failures do not crash audit.
- Each issue includes category, type, evidence, page, and recommendation seed.
- Existing scanner tests still pass.

## Phase 4 — AI-assisted drafts

Goal: use existing AI provider adapter to generate draft explanations and report copy.

Tasks:

- Add prompt templates.
- Add output schemas.
- Add prompt-injection defenses.
- Use mock AI in tests.
- Store AI task logs according to existing patterns.
- Route client-facing output through approval workflow.

Acceptance criteria:

- Invalid AI output is rejected.
- Drafts are not client-visible.
- No real keys needed.
- AI cannot invent unsupported findings.

## Phase 5 — Canonical report builder and exports

Goal: generate a Fiverr-ready report from approved canonical data.

Tasks:

- Add `GEO_AEO_AUDIT` report builder.
- Add canonical report payload.
- Add Markdown export.
- Add PDF export if existing adapter supports it.
- Add Fiverr delivery message generation.
- Add report/export tests.

Acceptance criteria:

- Report excludes hidden/draft findings.
- Report includes disclaimer.
- Markdown export works.
- PDF export does not break build.

## Phase 6 — API routes or server actions

Goal: expose the workflow safely.

Endpoints/actions:

```txt
profile create/update
prompt generation
scan run
manual observation create/update/delete
score generation
recommendation draft generation
report generation
export
```

Acceptance criteria:

- Auth required.
- Tenant/client/audit access enforced.
- Inputs validated.
- Rate limits applied where available.
- Cross-tenant tests pass.

## Phase 7 — Admin UI

Goal: make the operator workflow usable for Fiverr fulfillment.

Admin screens:

```txt
GEO/AEO overview
Business profile/intake
Prompts
Manual observations
Competitors
Score and recommendations
Report/export
```

Tasks:

- Add audit type selector/tab.
- Add fulfillment checklist.
- Add approve/edit/hide controls using existing approval workflow.
- Add export buttons.

Acceptance criteria:

- Admin can complete a full report flow.
- Draft state is visible to admin.
- Client-facing state requires approval.

## Phase 8 — Optional client UI

Goal: show approved AI visibility output in the client dashboard if safe.

Tasks:

- Add gated client AI Visibility page.
- Show approved score, quick wins, 30-day plan, and report download.
- Add upgrade CTA.

Acceptance criteria:

- License gates enforced server-side.
- Draft/hidden data excluded.

## Phase 9 — QA, docs, demo

Goal: leave the repo runnable, tested, and documented.

Tasks:

- Add docs under `docs/geo-aeo/`.
- Add demo seed if pattern exists.
- Run typecheck, lint, tests, build.
- Update implementation notes with known limitations.

Acceptance criteria:

- Existing product flows still work.
- GEO/AEO happy path works.
- Known limitations documented.

## Minimal shippable backend/report slice

If the feature is too large for one pass, ship this first:

```txt
Audit/report enum values
Feature flags
GeoAuditProfile
GeoPrompt
GeoVisibilityObservation
Prompt generator
Manual observations
AI Visibility Score
5 core scanners
GEO/AEO report payload
Markdown export
Admin-only minimal workflow
Tests
```

Five core scanners:

```txt
entity-clarity
ai-answer-coverage
ai-citable-content
geo-schema-readiness
sourceable-claims
```

Defer:

```txt
PDF polish
monthly monitoring dashboard
live platform checks
advanced competitor source imports
white-label customizations
```
