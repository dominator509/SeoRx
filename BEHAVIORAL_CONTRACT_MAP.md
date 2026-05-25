# BEHAVIORAL_CONTRACT_MAP

## Scope
- Repository: `Seo-Rx-Insights`
- Primary runtime boundaries:
- `artifacts/api-server` (Express API + RBAC + async workflows)
- `artifacts/seorx` (React UI + generated API client hooks)
- `lib/db` (Drizzle schema and persistence contracts)

## Core Stateful Entities
- `users`: identity, global role, profile fields.
- `organizations` + `org_members`: tenancy boundary and org role.
- `clients`: org-scoped customer records.
- `audits`: client-scoped crawl/analysis jobs with lifecycle status.
- `audit_issues`: audit findings with approval lifecycle.
- `reports`: audit-derived artifacts with generation lifecycle.
- `page_speed_results`: per-audit/per-device performance snapshots.
- `ai_providers`: org-scoped AI configuration and defaults.
- `org_integrations` + `org_webhooks`: external integration state and delivery metadata.
- `api_keys`: org-scoped developer auth credentials and activity status.

## Behavioral Contracts By Workflow

### 1) Authentication And User Provisioning
- Input:
- Clerk-authenticated request (`clerkUserId` present) or unauthenticated request.
- State mutation:
- First authenticated request may auto-provision `users` row in `loadUserContext`.
- Profile update mutates `users` (`firstName`, `lastName`, `avatarUrl`, `updatedAt`).
- Output:
- Protected routes return `401` without auth.
- `/api/auth/me` returns stable user object for authenticated principal.

### 2) Tenancy And RBAC
- Input:
- Authenticated principal with `users.role` and org memberships.
- State mutation:
- Request-local context (`req.seorxUser`, `req.orgMemberships`, `req.currentOrgId`, `req.currentOrgRole`).
- Output:
- Non-members receive `403` for restricted org/client/audit/report resources.
- Superadmin has global visibility, constrained only by explicit route contracts.

### 3) Client Lifecycle
- Input:
- Create/update/delete/list requests under authenticated user context.
- State mutation:
- `clients` insert/update/delete.
- Output:
- Query responses scoped to allowed orgs.
- Aggregate fields (`auditCount`, `issueCount`) are present in response shape.

### 4) Audit Lifecycle
- Input:
- `POST /api/audits` with `clientId`, URL, options.
- State mutation:
- Insert `audits` row (`pending`) then async transition (`running` -> `completed|failed`).
- Insert `audit_issues`; update client SEO summary fields.
- Optional `page_speed_results` seed for desktop/mobile.
- Output:
- Immediate `201` with pending audit payload.
- Subsequent reads expose deterministic status and enriched issue counts.

### 5) Issue Triage Lifecycle
- Input:
- Approve/dismiss commands on issue IDs.
- State mutation:
- `audit_issues.status` transitions (`open` -> `approved|dismissed`) and approval metadata.
- Output:
- Authorized users receive updated issue object; unauthorized users receive `403`.

### 6) Report Lifecycle
- Input:
- `POST /api/reports` with `auditId`.
- State mutation:
- Insert report in `generating`; async transition to `ready|failed`.
- `downloadUrl`, `summary`, `updatedAt` set on completion.
- Output:
- `GET /reports/:id/download` returns `409` until status is `ready`, then PDF stream.

### 7) Dashboard Aggregations
- Input:
- Authenticated request with org-scoped client visibility.
- State mutation:
- None (read-only aggregation).
- Output:
- Aggregate endpoints return stable typed shapes for both empty and populated states.

### 8) API Key Management
- Input:
- Authenticated org member/superadmin for CRUD; bearer key for developer auth.
- State mutation:
- `api_keys` insert/update/delete; `lastUsedAt` updated on successful key auth.
- Output:
- Key hash never exposed in API responses.
- Inactive/invalid keys return `401`.

### 9) Integrations (GSC/Webhooks)
- Input:
- Org-scoped integration and webhook operations.
- State mutation:
- Token storage/refresh (`org_integrations`), webhook registration, delivery status fields.
- Output:
- Graceful unavailable states when provider credentials are missing.
- Deterministic OAuth redirect/callback behavior and safe secret redaction.

### 10) Billing Boundary
- Input:
- Plan queries, checkout/portal requests, Stripe webhook payloads.
- State mutation:
- Organization plan updates from validated webhook events.
- Output:
- Safe disabled behavior when Stripe env is absent (`503`/guarded responses).
- Invalid webhook signatures rejected (`400`).

## Concurrency-Critical Contracts
- Concurrent first-login requests for same Clerk user must not duplicate user rows (`onConflictDoNothing` + refetch path).
- Fire-and-forget audit and report jobs must converge to terminal states (`completed|failed`, `ready|failed`) without orphaning pending rows.
- Concurrent API-key authorization must remain idempotent on access control and safely update `lastUsedAt`.

## External Dependency Boundaries To Mock
- Clerk user/profile API (`@clerk/express`).
- Web crawl and AI provider HTTP calls (`fetch`).
- Google APIs (OAuth token, Search Console endpoints).
- PageSpeed API endpoint.
- Stripe SDK/webhook verification.
- Network webhook targets.

## Determinism Requirements For New Tests
- No live external network dependency.
- Reproducible seeded test data and stable time-sensitive assertions.
- Explicit assertions for:
- Input validation behavior.
- Database state mutation behavior.
- Response schema/output behavior.
- Failure mode degradation paths.
