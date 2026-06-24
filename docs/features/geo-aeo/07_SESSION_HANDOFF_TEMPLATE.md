# GEO/AEO Codex Session Protocol and Handoff Template

Use this protocol for every Codex session that touches the SEORx GEO/AEO AI Visibility Audit feature.

## 1. Session start checklist

At the start of each session, Codex should inspect:

```txt
README.md
ARCHITECTURE.md
BUILD_ROADMAP.md
AGENTS.md
SECURITY.md
.env.example
package.json
prisma/schema.prisma
existing audit services
existing scanner registry
existing scoring service
existing AI adapter/prompt infrastructure
existing approval workflow
existing report/export services
existing API route wrappers
existing tests/fixtures/helpers
```

Then state:

```txt
- current phase
- smallest coherent patch planned
- files expected to change
- tests expected to run
- assumptions
- blockers/risk if any
```

## 2. Patch-size rule

Prefer one of these coherent patch types:

```txt
docs + flags + constants
schema + migration + tests
service + unit tests
scanner + fixture + tests
API route + integration/security tests
UI flow + E2E test
report payload + export tests
```

Avoid giant mixed patches unless the repo is very small.

## 3. Required coding loop

```txt
1. Inspect current implementation.
2. Choose smallest useful patch.
3. Implement code.
4. Add/update tests.
5. Run targeted tests.
6. Run typecheck/lint when feasible.
7. Update docs.
8. Summarize clearly.
```

## 4. Blocker protocol

Do not get stuck silently.

If blocked by missing convention:

```txt
Inspect related features and adapt the closest pattern.
Document the assumption.
Continue if safe.
```

If blocked by missing real API key:

```txt
Use mock adapter.
Keep real call behind feature flag.
Continue.
```

If blocked by migration risk:

```txt
Stop.
Explain the risk.
Do not run or write destructive migration.
Suggest a safe migration path.
```

If blocked by failing tests:

```txt
Make at most two focused fix attempts.
If still failing, document exact failing command/output and the likely cause.
Do not claim success.
```

If blocked by unsafe scraping requirement:

```txt
Do not implement scraping.
Use manual observation or approved API adapter mode.
Document the limitation.
```

## 5. End-of-session handoff

Every Codex response after code changes must use this format:

```txt
Completed:
- ...

Files changed:
- ...

Database/migrations:
- ...

Tests run:
- ...

Results:
- ...

Security checks:
- ...

Feature flags/env changes:
- ...

Docs updated:
- ...

Known limitations:
- ...

Next recommended step:
- ...
```

## 6. Done/Not done labels

Use clear labels:

```txt
DONE
- fully implemented and tested

PARTIAL
- implemented but missing tests, UI, docs, or coverage

BLOCKED
- cannot proceed safely without repo decision or migration/API/security resolution

DEFERRED
- intentionally left out of MVP
```

## 7. Test command reporting

Always report exact commands run.

Good:

```txt
npm run test:unit -- geo-scoring
npm run typecheck
npm run lint
```

Bad:

```txt
Tests passed.
```

## 8. Security reporting

Every session should explicitly state whether it touched:

```txt
auth
RBAC
tenant isolation
crawler/URL fetching
AI prompts/output
exports
migrations
secrets/env
client-visible data
```

If it touched any of these, summarize the check performed.

## 9. Final feature handoff

When the whole feature is ready, produce this final summary:

```txt
Feature status:
- Complete / Partial / Blocked

End-to-end workflow verified:
- Admin create audit: yes/no
- Intake profile: yes/no
- Prompt generation: yes/no
- Crawl/scan: yes/no
- Manual observations: yes/no
- Score calculation: yes/no
- Recommendation approval: yes/no
- Report generation: yes/no
- PDF export: yes/no
- Markdown export: yes/no
- Client dashboard/report access: yes/no

Tests:
- Unit: pass/fail/not run
- Integration: pass/fail/not run
- E2E: pass/fail/not run
- Security: pass/fail/not run
- Migration: pass/fail/not run

Remaining risks:
- ...

Deployment notes:
- ...

Next commercial enhancement:
- monthly monitoring / implementation upsell / API-supported observations / client dashboard expansion
```

