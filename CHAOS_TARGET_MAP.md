# CHAOS_TARGET_MAP

1. **Integration OAuth and token lifecycle (`artifacts/api-server/src/routes/integrations.ts`)**
- Risk: state deserialization (`state` JSON), token refresh races, upstream failure passthrough.
- Attack vector: malformed `state`, stale/invalid encrypted tokens, repeated analytics calls with boundary payloads.

2. **Tenant mutation boundaries (`clients`, `audits`, `issues`, `reports` routes)**
- Risk: cross-org access leakage and out-of-order workflow mutation.
- Attack vector: foreign IDs, replaying terminal-state mutations, workflow skipping (report generation/download before readiness).

3. **API key authorization and concurrent state writes (`api-keys`, `developer/authorize`)**
- Risk: race conditions around key status, `lastUsedAt`, inactive key replay.
- Attack vector: high burst authorize calls with toggled key status and malformed bearer headers.

4. **Webhook and billing raw-body boundaries (`stripe`, `integrations/webhooks`)**
- Risk: parser boundary mismatch, signature handling, malformed event arrays.
- Attack vector: invalid content-type, oversized/invalid event lists, special-char URL payloads.

5. **Audit orchestration async chain (`audits` + crawler/analyzer + DB writes)**
- Risk: async partial failure causing orphaned audit/report state.
- Attack vector: forced upstream timeouts/errors mid-pipeline and concurrent triage against same audit entities.
