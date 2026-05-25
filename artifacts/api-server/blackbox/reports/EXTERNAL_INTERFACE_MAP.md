# EXTERNAL_INTERFACE_MAP

| Method | Path | Auth | Req Body | Responses |
|---|---|---|---|---|
| GET | /api/ai-providers | bearerAuth | - | 200, 401 |
| POST | /api/ai-providers | bearerAuth | application/json | 201, 401 |
| DELETE | /api/ai-providers/{id} | bearerAuth | - | 204, 401, 404 |
| PUT | /api/ai-providers/{id} | bearerAuth | application/json | 200, 401, 404 |
| GET | /api/api-keys | bearerAuth | - | 200, 401, 403 |
| POST | /api/api-keys | bearerAuth | application/json | 201, 401, 403 |
| DELETE | /api/api-keys/{id} | bearerAuth | - | 204, 401, 403, 404 |
| PATCH | /api/api-keys/{id} | bearerAuth | application/json | 200, 401, 403, 404 |
| GET | /api/audits | bearerAuth | - | 200, 401 |
| POST | /api/audits | bearerAuth | application/json | 201, 401 |
| DELETE | /api/audits/{id} | bearerAuth | - | 204, 401, 404 |
| GET | /api/audits/{id} | bearerAuth | - | 200, 401, 404 |
| GET | /api/audits/{id}/issues | bearerAuth | - | 200, 401, 404 |
| GET | /api/auth/me | bearerAuth | - | 200, 401 |
| PUT | /api/auth/me | bearerAuth | application/json | 200, 401 |
| POST | /api/billing/checkout | bearerAuth | application/json | 200, 400, 401, 403, 503 |
| GET | /api/billing/plans | none | - | 200 |
| POST | /api/billing/portal | bearerAuth | application/json | 200, 400, 401, 403, 503 |
| POST | /api/billing/webhook | none | application/json | 200, 400, 500 |
| GET | /api/clients | bearerAuth | - | 200, 401 |
| POST | /api/clients | bearerAuth | application/json | 201, 401 |
| DELETE | /api/clients/{id} | bearerAuth | - | 204, 401, 404 |
| GET | /api/clients/{id} | bearerAuth | - | 200, 401, 404 |
| PUT | /api/clients/{id} | bearerAuth | application/json | 200, 401, 404 |
| GET | /api/dashboard/issue-breakdown | bearerAuth | - | 200, 401 |
| GET | /api/dashboard/recent-audits | bearerAuth | - | 200, 401 |
| GET | /api/dashboard/score-trends | bearerAuth | - | 200, 401 |
| GET | /api/dashboard/stats | bearerAuth | - | 200, 401 |
| GET | /api/developer/authorize | bearerAuth | - | 200, 401 |
| GET | /api/healthz | none | - | 200 |
| POST | /api/integrations/gsc/analytics | bearerAuth | application/json | 200, 401 |
| GET | /api/integrations/gsc/callback | bearerAuth | - | 302, 400, 401, 403 |
| GET | /api/integrations/gsc/connect | bearerAuth | - | 302, 400, 401 |
| GET | /api/integrations/gsc/properties | bearerAuth | - | 200, 401 |
| GET | /api/integrations/webhooks | bearerAuth | - | 200, 401 |
| POST | /api/integrations/webhooks | bearerAuth | application/json | 201, 401 |
| DELETE | /api/integrations/webhooks/{id} | bearerAuth | - | 204, 401, 404 |
| POST | /api/integrations/webhooks/test | bearerAuth | application/json | 200, 401 |
| PUT | /api/issues/{id}/approve | bearerAuth | application/json | 200, 401, 404 |
| PUT | /api/issues/{id}/dismiss | bearerAuth | application/json | 200, 401, 404 |
| GET | /api/organizations | bearerAuth | - | 200, 401 |
| POST | /api/organizations | bearerAuth | application/json | 201, 401 |
| DELETE | /api/organizations/{id} | bearerAuth | - | 204, 401, 404 |
| GET | /api/organizations/{id} | bearerAuth | - | 200, 401, 404 |
| PUT | /api/organizations/{id} | bearerAuth | application/json | 200, 401, 404 |
| GET | /api/organizations/{orgId}/members | bearerAuth | - | 200, 401 |
| POST | /api/organizations/{orgId}/members | bearerAuth | application/json | 201, 401 |
| GET | /api/pagespeed/{auditId} | bearerAuth | - | 200, 401, 404 |
| GET | /api/reports | bearerAuth | - | 200, 401 |
| POST | /api/reports | bearerAuth | application/json | 201, 401 |
| DELETE | /api/reports/{id} | bearerAuth | - | 204, 401, 404 |
| GET | /api/reports/{id} | bearerAuth | - | 200, 401, 404 |
| GET | /api/reports/{id}/download | bearerAuth | - | 200, 401, 404, 409 |
