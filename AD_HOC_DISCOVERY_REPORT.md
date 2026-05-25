# AD_HOC_DISCOVERY_REPORT

## Campaign Summary
This ad hoc campaign executed deterministic chaos probes across integration boundaries, state mutation paths, concurrency hotspots, and workflow derailment surfaces.
Application code was not modified.

## Top Successful Disruptions

1. **Webhook payload type confusion triggers server error**
- Surface: `POST /api/integrations/webhooks`
- Vector: send `events` as string instead of array (`"audit.completed"`)
- Observed: `500` response path reached instead of deterministic `400` validation failure.
- Repro source: `artifacts/api-server/src/test/api.integration.test.ts` (Phase 2 describe block)
- Impact: malformed external sender payload can push handler into server-error branch; missing graceful degradation envelope.

2. **Malformed analytics payload accepted with 200 response**
- Surface: `POST /api/integrations/gsc/analytics`
- Vector: null/number/object-typed fields for dates and dimensions.
- Observed: request accepted with `200` and rows payload rather than rejection.
- Impact: permissive boundary increases risk of silent downstream data quality corruption.

3. **Test/bootstrap DB migration instability under repeated runs**
- Surface: test harness initialization (`corepack pnpm --filter @workspace/db run migrate`)
- Vector: repeated targeted suite invocations.
- Observed: intermittent `ECONNRESET` / `Connection terminated unexpectedly` before test execution.
- Impact: non-deterministic CI behavior; can mask regressions and reduce confidence in chaos replay.

## Concurrency/State Outcomes
- Burst malformed auth header requests remained bounded (`400|401`), no server crash.
- 40-way issue mutation storm kept terminal state valid (`approved|dismissed`) and avoided lockup.
- Revoked API key replay was denied (`401`) after deactivation, preserving auth contract.

## Artifacts
- `CHAOS_TARGET_MAP.md`
- `chaos-logs/phase2-data-mutation.md`
- `chaos-logs/phase3-concurrency.md`
- `chaos-logs/phase4-persona-derailment.md`
- Exploratory probes: `artifacts/api-server/src/test/api.integration.test.ts`

## Execution Evidence
- Full API suite with exploratory probes: `corepack pnpm --filter @workspace/api-server run test` -> pass (`52/52`)
- Intermittent targeted-run bootstrap failures recorded separately in phase logs.

## Recommended Follow-up (No Fix Applied Here)
1. Add explicit schema validation for webhook `events` and enforce array type before DB write.
2. Add strict request validation for GSC analytics body types and reject malformed fields with `400`.
3. Stabilize test bootstrap sequencing/retries around DB container readiness + migration handshake.
