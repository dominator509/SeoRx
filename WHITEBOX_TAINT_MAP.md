# WHITEBOX_TAINT_MAP

## Source -> Validation -> Sink Trace

1. `POST /api/integrations/webhooks`
- Source: `req.body.{orgId,url,events,secret}`
- Validation: explicit runtime guards in `routes/integrations.ts` (`isNonEmptyString`, array shape checks, secret type checks, URL parse)
- Sinks: DB insert into `orgWebhooksTable`, secret encryption path
- Whitebox tests:
  - malformed events string rejected (`400`)
  - non-string secret rejected (`400`)

2. `POST /api/integrations/gsc/analytics`
- Source: `req.body.{orgId,siteUrl,startDate,endDate,dimensions}`
- Validation: strict type/date/dimension guards before token retrieval and outbound API call
- Sinks: outbound fetch to Google Search Console endpoint
- Whitebox tests:
  - malformed date/type payload rejected (`400`)

3. `GET /api/integrations/gsc/callback`
- Source: `req.query.state`
- Validation: `try/catch` parse boundary with sanitized error envelope
- Sink: token exchange + DB write (only after parse/authorization success)
- Whitebox tests:
  - malformed JSON state forced through catch path (`500`, safe body, no stack details)

## Residual Risk Notes
- Sanitization now blocks malformed types before DB/network sinks in covered integration surfaces.
- Remaining untrusted paths should follow same guard pattern when new payload fields are introduced.
