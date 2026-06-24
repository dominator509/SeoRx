# SEORx GEO/AEO Codex Build Pack

This pack is designed to be copied into an existing hardened SEORx repository before assigning the GEO/AEO feature build to Codex.

Recommended placement:

```txt
repo-root/
├── AGENTS.md                                  # existing repo instructions, keep them
├── docs/
│   └── geo-aeo/
│       ├── GEO_AEO_FEATURE_SPEC.md
│       ├── GEO_AEO_BUILD_ROADMAP.md
│       ├── GEO_AEO_AGENT_GUARDRAILS.md
│       ├── GEO_AEO_ACCEPTANCE_CRITERIA_AND_TEST_PLAN.md
│       ├── GEO_AEO_REPORT_TEMPLATE.md
│       └── GEO_AEO_FILE_MAP.md
└── CODEX_GEO_AEO_MASTER_PROMPT.md             # paste into Codex, or keep as task doc
```

How to use:

1. Copy these files into the repo.
2. Paste `CODEX_GEO_AEO_MASTER_PROMPT.md` into Codex as the task prompt.
3. Tell Codex to read the repo's existing `AGENTS.md`, architecture docs, roadmap docs, and the `docs/geo-aeo/*` files before editing.
4. Let Codex implement in small verified increments.
5. Review the resulting PR carefully, especially migrations, access checks, AI prompts, report copy, and feature flags.

The feature target is not a separate product. It is a new SEORx audit/report mode:

```txt
GEO / AEO AI Visibility Audit
"Get found in ChatGPT, Gemini, Perplexity, and Google AI Overviews"
```

Non-negotiable safety/product rules:

- No guaranteed rankings, traffic, leads, revenue, AI citations, or AI Overview placement.
- No prohibited scraping or automated querying of ChatGPT, Gemini, Perplexity, Google Search, Google AI Overviews, or Google AI Mode.
- Manual observations and approved/provider-backed integrations only.
- Every finding must be evidence-backed.
- AI drafts must remain drafts until approved.
- Reports must be generated from approved canonical audit data.
- Existing tenant/RBAC/licensing/security patterns must be preserved.
- External integrations must be feature-flagged and mocked in tests.
