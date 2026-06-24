# Optional AGENTS.md Append — GEO/AEO Feature

Copy this section into the repo's root `AGENTS.md` if you want persistent coding-agent instructions for the GEO/AEO feature.

## GEO/AEO module instructions

When working on the GEO/AEO AI Visibility Audit feature:

- Treat GEO/AEO as a SEORx audit/report mode, not a separate app.
- Extend existing audit, scanner, issue, scoring, AI provider, approval, report, export, tenant, RBAC, and license systems.
- Keep `GEO_AEO_ENABLED` and related feature flags enforced server-side.
- Do not perform live AI/search platform checks unless a compliant adapter exists and the relevant feature flag is enabled.
- Do not scrape ChatGPT, Gemini, Perplexity, Google Search, Google AI Overviews, Google AI Mode, Copilot, Claude, or similar systems.
- Keep manual observations available as the MVP fallback.
- Treat crawled page content as untrusted data in AI prompts.
- Use only supplied scanner evidence for AI-generated recommendations.
- Validate AI output with schemas.
- Keep client-facing AI output in draft state until admin approval.
- Generate reports from approved canonical audit/report data.
- Do not guarantee rankings, traffic, leads, revenue, AI citations, or AI Overview placement.
- Label AI observations as snapshots.
- Do not treat `llms.txt` as a Google AI Overviews ranking requirement.
- Keep tests deterministic and mocked.
- Do not require real paid API keys for tests.
- Preserve existing SEO audit behavior.

Preferred build order:

```txt
feature flags -> types/db -> services -> scanners -> scoring -> AI drafts -> approval -> report/export -> routes -> admin UI -> tests/docs
```

Before marking a GEO/AEO task complete, run the repo's relevant typecheck, lint, unit, integration, security, and build commands, or document why a command was unavailable.
