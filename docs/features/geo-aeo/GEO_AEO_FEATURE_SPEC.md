# SEORx GEO/AEO Feature Spec

## Feature name

GEO / AEO AI Visibility Audit

## Public positioning

```txt
Get found in ChatGPT, Gemini, Perplexity, and Google AI Overviews.
```

## Product positioning

The GEO/AEO feature is a new SEORx audit/report type that evaluates whether a business website is easy for AI answer engines and modern search experiences to understand, summarize, cite, and recommend.

It does not replace the standard SEO Leak Audit. It extends SEORx into answer-engine readiness, AI-citability, entity clarity, sourceability, competitor comparison, FAQ/schema recommendations, AI-citable service pages, citation/source recommendations, and a 30-day action plan.

## Target buyer

- Local businesses
- Service businesses
- Ecommerce stores
- Consultants
- Agencies
- Creator brands
- SMBs that know AI search matters but do not know what to buy

## Primary Fiverr deliverable

A professional report that includes:

- AI Visibility Score
- Prompt set generated/tested
- Competitor comparison
- Page-by-page AI-citability review
- Top GEO/AEO blockers
- FAQ/schema recommendations
- AI-citable service page recommendations
- Citation/source recommendations
- 30-day action plan
- Optional monthly monitoring upsell

## Feature promise

Give the client a clear answer to:

```txt
When someone asks an AI answer engine for a business like mine, is my site structured clearly enough to be understood, trusted, cited, or recommended — and what should I fix first?
```

## Non-goals

- Guaranteed ChatGPT rankings
- Guaranteed Google AI Overview placement
- Guaranteed Perplexity citations
- Guaranteed Gemini recommendations
- Automated scraping of AI/search platforms
- A general-purpose rank tracker
- A new standalone app
- A replacement for the existing SEO audit system

## Core workflow

```txt
1. Admin creates or opens an audit.
2. Admin selects GEO/AEO or Hybrid audit mode.
3. Admin enters buyer intake details.
4. Admin adds competitors.
5. System generates prompt set.
6. System reuses or runs crawl.
7. GEO/AEO scanners evaluate AI-citability, entity clarity, schema, proof, service-page gaps, and sourceability.
8. Admin optionally adds manual AI observations.
9. System calculates AI Visibility Score.
10. AI drafts explanations, recommendations, 30-day plan, and delivery message using approved evidence only.
11. Admin reviews/edits/approves/hides output.
12. System generates report and exports PDF/Markdown.
13. Admin delivers report on Fiverr and offers implementation or monitoring upsell.
```

## Required intake fields

```txt
businessName
websiteUrl
primaryServiceOrProduct
targetLocations
targetCustomers
competitors
proofPoints
reviewProfileUrls
googleBusinessProfileUrl
importantServicePages
commonBuyerQuestions
whatTheBusinessWantsToBeKnownFor
packageTier
```

## Prompt-set categories

```txt
Discovery
Local service
Best provider
Comparison
Pricing
Problem / solution
FAQ
Alternative
Trust validation
```

## AI Visibility Score

Separate from the normal SEO health score.

```txt
20% AI answer coverage
15% Entity clarity
15% AI-citable page structure
15% Proof, trust, and sourceability
10% Schema / structured data readiness
10% Crawlability and indexability
10% Competitor visibility gap
5% Local / ecommerce data completeness
```

## Score grades

```txt
90-100 Excellent
75-89 Strong
60-74 Needs Work
40-59 Weak
0-39 Critical
```

## Issue categories

```txt
AI Answer Coverage
Entity Clarity
AI-Citable Structure
Proof and Trust
Schema Readiness
Crawlability / Indexability
Competitor Gap
Service / Location Page Gaps
Citation / Source Readiness
```

## Required issue types

```txt
AI_VISIBILITY_ZERO_BASELINE
WEAK_ENTITY_DEFINITION
UNCLEAR_SERVICE_POSITIONING
MISSING_DIRECT_ANSWER_BLOCKS
WEAK_FAQ_COVERAGE
MISSING_SCHEMA_FOR_AI_CONTEXT
WEAK_SOURCEABLE_CLAIMS
NO_PROOF_OR_CASE_STUDIES
COMPETITOR_OWNS_AI_PROMPT
MISSING_COMPARISON_CONTENT
MISSING_SERVICE_PAGE
MISSING_LOCATION_PAGE
INCONSISTENT_BRAND_ENTITY
LOW_EXTERNAL_CITATION_COVERAGE
AI_CRAWLABILITY_RISK
GENERIC_COMMODITY_CONTENT
WEAK_AUTHOR_OR_ORGANIZATION_TRUST
MISSING_REVIEW_OR_TESTIMONIAL_PROOF
MISSING_SAME_AS_OR_ENTITY_LINKS
PROMPT_INTENT_GAP
```

## Fiverr package presets

### Basic — AI Visibility Snapshot

Scope:

```txt
5 pages
10 prompts
2 competitors
```

Includes:

```txt
AI visibility score
Top GEO/AEO blockers
Basic prompt set
PDF or Markdown report
30-day quick-win plan
```

### Standard — GEO/AEO Audit + Competitor Gap

Scope:

```txt
10 pages
25 prompts
3 competitors
```

Includes:

```txt
Everything in Basic
Competitor comparison
FAQ/schema recommendations
AI-citable page recommendations
Priority fix list
```

### Premium — Full AI Visibility Roadmap

Scope:

```txt
25 pages
50 prompts
5 competitors
```

Includes:

```txt
Everything in Standard
Service page outlines
Citation/source roadmap
Developer-ready task list
Implementation plan
Monthly monitoring proposal
```

## Manual observation mode

Manual observations let the operator paste or summarize AI answer snapshots without automated scraping.

Fields:

```txt
surface
prompt
observedAt
brandMentioned
brandCited
brandPosition
competitorsMentioned
citedUrls
answerSummary
rawAnswerExcerpt
confidenceScore
notes
```

Client-facing copy must label observations as snapshots.

## Required disclaimer

```txt
AI-generated answers vary by model, location, prompt wording, date, personalization, available sources, and index freshness. This audit identifies practical improvements that may make the business easier for search engines and AI answer systems to understand, summarize, cite, and recommend. It does not guarantee rankings, traffic, leads, revenue, AI citations, or placement in Google AI Overviews, AI Mode, ChatGPT, Gemini, Perplexity, or any other system.
```
