# Phase 4 - Persona-Based Workflow Derailment

## Hypotheses
1. Out-of-sequence report lifecycle calls may leak data or crash handlers.
2. Mid-workflow credential revocation may fail to invalidate replayed API key sessions.

## Executed Vectors
- Report download requested for random UUID before report generation.
- API key created, then deactivated, then replayed in `developer/authorize`.

## Observed Results
- Unknown report download denied with `404` (no leak of protected document).
- Revoked API key replay denied with `401`.

## Additional Observations
- Malformed webhook registration (`events` as string) still routes into `500` server error path from Phase 2, indicating validation hardening gap under persona misuse.
