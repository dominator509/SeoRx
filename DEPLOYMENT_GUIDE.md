# SEORx Deployment Guide

## Requirements
- Node.js 24+
- pnpm
- PostgreSQL
- Clerk app keys
- Optional: Stripe, Google Search Console, PageSpeed, ENCRYPTION_KEY

## Environment Variables
Set these in Replit or production secrets:
- DATABASE_URL
- CLERK_PUBLISHABLE_KEY
- CLERK_SECRET_KEY
- SESSION_SECRET
- ENCRYPTION_KEY
- ALLOWED_ORIGINS
- PAGESPEED_API_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_PRICE_STARTER_MONTHLY
- STRIPE_PRICE_PROFESSIONAL_MONTHLY
- STRIPE_PRICE_ENTERPRISE_MONTHLY
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- API_BASE_URL

## Build
1. Install dependencies
2. Run database push for the DB package
3. Run typecheck
4. Build both artifacts

## Runtime
- API server must bind to `PORT` and serve under `/api`
- Frontend must bind to `PORT` and serve at `/`
- Use the provided Replit workflows for both services

## Verification
- `/api/healthz` returns `{"status":"ok"}`
- `/api/docs` loads Swagger UI
- `/api/openapi.json` returns the spec
- Frontend loads at `/`

## Notes
- The app is production-safe with graceful fallback behavior when optional integrations are unset.
- API keys are hashed, AI provider secrets are encrypted, and billing/webhooks are disabled cleanly if keys are missing.
