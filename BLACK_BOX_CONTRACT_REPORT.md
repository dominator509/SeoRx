# BLACK_BOX_CONTRACT_REPORT

- Generated: 2026-05-25T12:12:30.737Z
- Documented operations: 53
- Documented endpoint paths: 36
- Tested endpoint paths: 8
- Endpoint path coverage: 22.22%

## Phase Results

### Phase 2 (Equivalence/Boundary)
- Total test cases: 7
- Unexpected responses: 7

### Phase 3 (State/Workflow)
- Steps executed: 3
- Auth token provided: no

### Phase 4 (Negative/Leakage)
- Probes executed: 4
- Leakage findings: 0

## Deviations and Unhandled Exceptions

- healthz baseline: got 500, expected one of 200
- auth required on /auth/me: got 500, expected one of 401
- create org missing required fields: got 500, expected one of 400, 401, 422
- create org boundary long fields: got 500, expected one of 400, 401, 413, 422
- create audit invalid URI + negative maxPages: got 500, expected one of 400, 401, 422
- list audits limit min boundary: got 500, expected one of 200, 400, 401, 422
- list audits limit max int boundary: got 500, expected one of 200, 400, 401, 413, 422

- No obvious stack/schema/version leakage detected in sampled error payloads.
