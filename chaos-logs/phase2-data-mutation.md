# Phase 2 - Data Mutation & Malformed Payload Injection

## Hypotheses
1. Webhook event type confusion (`events` as string) should be rejected as a client-side validation error.
2. Malformed OAuth state JSON may trigger parser faults and leak internals.
3. GSC analytics endpoint should reject malformed typed payloads rather than silently accepting.

## Deterministic Probes
- `GET /api/integrations/gsc/callback?code=sample-auth-code&state={"orgId":`
- `POST /api/integrations/webhooks` with `events: "audit.completed"`
- `POST /api/integrations/gsc/analytics` with null/number/object-typed date/dimension fields

## Observed Results
- OAuth malformed state returned `400` in current env path (credential gate), with safe error body shape.
- Webhook type confusion returned `500` (unexpected server fault path) instead of deterministic `400`.
- Analytics malformed payload returned `200`, indicating permissive acceptance despite malformed fields.

## Exploitability Signal
- High: webhook payload type confusion can force server error path.
- Medium: analytics permissiveness can hide malformed producer behavior and poison downstream assumptions.
- Low/Contextual: OAuth malformed state currently gated before JSON parse in this environment.
