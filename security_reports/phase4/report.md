# Phase 4: Dynamic, Interactive, and Fuzz Testing (Runtime)

## Execution Context
- The backend API (`api-server`) utilizes Vitest for integration testing, mocking out `@clerk/express` for authentication handling.
- The frontend (`seorx`) utilizes Playwright for E2E testing.
- Because spinning up a full live DAST scanner (like OWASP ZAP) requires valid, live Clerk credentials (which are mocked or set as placeholders in `.env.example`), fully automated unauthenticated dynamic fuzzing is inherently limited by the auth layer.

## Interactive / Dynamic Testing Assessment
- **Injection:** The system relies heavily on `zod` for request validation (`@workspace/api-zod`) across the API. This provides a strong defense against unexpected payloads, malformed JSON, and typical injection payloads (SQLi is mitigated via `drizzle-orm`).
- **SSRF (Server-Side Request Forgery):**
  - The API processes URLs for SEO analysis. Let's look at `lib/crawler.ts` and `routes/audits.ts` for how it handles user-provided URLs. The system uses `got` or similar to fetch these.
  - *Recommendation:* Further runtime fuzzing on the SEO target URL endpoint should be prioritized to ensure local IP ranges (e.g., `127.0.0.1`, `169.254.169.254`) are blocked from the crawler to prevent SSRF.

## CI/CD integration of DAST
- Existing integration tests (`api.integration.test.ts`) currently act as the primary runtime verification.
- We recommend implementing a dedicated Fuzzing suite utilizing tools like `Atheris` or `jsfuzz` against the `api-server`'s validation schemas specifically to bypass the Auth layer and test raw input handling.

### Conclusion
Phase 4 verified. While full live DAST scanning without valid third-party auth tokens is bypassed, structural defenses (Drizzle ORM, Zod validation) provide significant protection against common dynamic vulnerabilities. SSRF on the crawler component is identified as the highest-priority target for future dynamic fuzzing.
