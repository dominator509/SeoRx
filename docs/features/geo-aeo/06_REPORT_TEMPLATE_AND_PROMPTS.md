# GEO/AEO Report Template and AI Prompt Templates

## 1. Report title

```txt
AI Visibility Audit
Get Found in ChatGPT, Gemini, Perplexity, and Google AI Overviews
```

Alternative title:

```txt
GEO/AEO Audit: AI Visibility, Citation Readiness, and 30-Day Action Plan
```

## 2. Required report sections

### 1. Cover Page

Include:

```txt
Client/business name
Website URL
Audit date
Prepared by
Package tier
Disclaimer summary
```

### 2. Executive Summary

Include:

```txt
Overall AI Visibility Score
Plain-English interpretation
Top 3 blockers
Top 3 quick wins
Best implementation opportunity
```

Example structure:

```txt
Your current AI Visibility Score is {{score}}/100, which means your website has {{grade}} readiness for being understood, cited, and recommended by AI answer engines.

The biggest issue is not one single technical problem. It is that AI systems need clearer entity signals, more direct answer blocks, stronger proof, and better service/location coverage before they can confidently summarize or recommend the business.
```

### 3. What This Audit Measures

Explain:

```txt
AI mention readiness
AI citation readiness
Entity clarity
Prompt/query coverage
Competitor visibility gap
Schema/content opportunities
Proof/sourceability
Crawlability/indexability
```

### 4. AI Visibility Score

Include:

```txt
Overall score
Grade
Subscores
Interpretation
Top risks
Quick wins
```

### 5. Prompt Set Tested / Generated

Group prompts by intent:

```txt
Discovery
Local service
Comparison
Best provider
Pricing
Problem solution
FAQ
Alternative
Trust validation
```

Label whether prompts were:

```txt
Generated opportunity prompts
Manually observed prompts
API-supported observed prompts
Simulated retrieval/citability prompts
```

### 6. Baseline AI Visibility Snapshot

Include only if observation data exists.

Fields:

```txt
Surface
Prompt
Brand mentioned?
Brand cited?
Competitors mentioned
Cited sources
Sentiment
Observation date
Confidence
```

Required note:

```txt
These observations are snapshots. AI answers can vary by platform, user, prompt wording, location, personalization, and date.
```

### 7. Competitor Comparison

Compare:

```txt
Entity clarity
Service page coverage
FAQ/direct answer coverage
Schema readiness
Proof/reviews/case studies
Third-party sourceability
Content specificity
```

Do not claim competitor AI rank unless observation data supports it.

### 8. Page-by-Page AI-Citability Review

For each reviewed page:

```txt
Page URL
AI-citable score
Strengths
Gaps
Recommended fixes
Suggested answer blocks
Suggested schema/FAQ
```

### 9. Top GEO/AEO Issues

Each issue should include:

```txt
Issue title
Evidence
Why it matters
AI visibility impact
Business impact
Recommended fix
Priority
Estimated effort
Suggested owner
```

### 10. FAQ and Schema Fixes

Include:

```txt
FAQ questions to add
Recommended direct answers
Schema types to consider
Implementation notes
```

Common schema opportunities:

```txt
Organization
LocalBusiness
Service
FAQPage
BreadcrumbList
Article
Product
Review
```

Do not imply schema guarantees AI visibility.

### 11. AI-Citable Service Page Recommendations

For missing or weak pages, include:

```txt
Recommended URL
Recommended H1
Direct answer block
Suggested H2s
Proof blocks
FAQs
Internal links
Schema opportunities
```

### 12. Citation and Source Recommendations

Recommend source/citation opportunities:

```txt
Google Business Profile completeness
industry directories
local chamber/business directories
review platforms
credible third-party profiles
case studies/testimonials
press or community mentions
partner/vendor profiles
social/professional profiles
```

Do not call these backlinks unless backlink data exists.

### 13. 30-Day Action Plan

Suggested structure:

```txt
Week 1: Entity clarity and crawlability fixes
Week 2: FAQ/direct answer blocks and page structure
Week 3: Schema/internal linking/proof sections
Week 4: Citation/source building and re-check
```

### 14. Optional Next Steps

Include:

```txt
Implementation package
Monthly AI visibility monitoring
Hybrid SEO + GEO audit
Content/page rewrite package
Schema implementation package
```

### 15. Disclaimer

Required disclaimer:

```txt
AI-generated answers vary by model, platform, prompt wording, location, personalization, date, index freshness, and available sources. This audit identifies visibility, clarity, citation-readiness, and content opportunities. It does not guarantee rankings, traffic, leads, revenue, or placement in any AI-generated answer.
```

---

# 3. AI prompt templates

Codex should implement these using the repo’s existing prompt/template pattern.

## Prompt A — Generate prompt set

### System/developer instruction

```txt
You generate buyer-intent prompt sets for an AI visibility audit.

Use only the supplied business profile and audit context.
Do not invent services, locations, competitors, claims, certifications, reviews, or platform observations.
Generate practical prompts a buyer might ask ChatGPT, Gemini, Perplexity, Google AI Overviews, or another answer engine when looking for a business like this.
Return valid JSON only.
```

### Input fields

```json
{
  "businessName": "string",
  "websiteUrl": "string",
  "primaryOffer": "string",
  "targetServices": ["string"],
  "targetLocations": ["string"],
  "targetCustomers": ["string"],
  "competitors": [{ "name": "string", "url": "string" }],
  "customerQuestions": ["string"],
  "knownFor": "string",
  "packageTier": "basic|standard|premium|custom",
  "maxPrompts": 25
}
```

### Output schema

```json
{
  "prompts": [
    {
      "promptText": "string",
      "intent": "DISCOVERY|LOCAL_SERVICE|COMPARISON|BEST_PROVIDER|PRICING|PROBLEM_SOLUTION|FAQ|ALTERNATIVE|TRUST_VALIDATION",
      "targetService": "string|null",
      "targetLocation": "string|null",
      "buyerStage": "awareness|consideration|decision|retention|unknown",
      "priority": 1
    }
  ]
}
```

## Prompt B — Assess page citability

### System/developer instruction

```txt
You are analyzing a crawled website page for GEO/AEO readiness.

Goal:
Determine whether this page is structured so AI answer engines can understand, summarize, cite, or recommend it.

Use only the supplied crawl data, page extraction data, schema data, internal link data, and business profile. Do not invent facts.

Evaluate:
1. Entity clarity
2. Direct answer quality
3. Buyer question coverage
4. Heading structure
5. Evidence and proof
6. Schema opportunities
7. Internal linking
8. Service/location specificity
9. External citation readiness signals in supplied data
10. Content uniqueness and specificity

Do not guarantee AI rankings or citations.
Return valid JSON only.
```

### Output schema

```json
{
  "pageUrl": "string",
  "aiCitableScore": 0,
  "answerCoverageScore": 0,
  "entityClarityScore": 0,
  "proofSignalScore": 0,
  "structureScore": 0,
  "schemaReadinessScore": 0,
  "citationReadinessScore": 0,
  "summary": "string",
  "strengths": ["string"],
  "gaps": ["string"],
  "recommendedFixes": [
    {
      "title": "string",
      "whyItMatters": "string",
      "exactFix": "string",
      "priority": 1,
      "estimatedEffort": "low|medium|high"
    }
  ]
}
```

## Prompt C — Generate GEO/AEO recommendations

### System/developer instruction

```txt
You generate evidence-backed GEO/AEO recommendations for a client-facing AI Visibility Audit.

Rules:
- Use only supplied evidence.
- Do not invent crawl findings.
- Do not invent AI platform observations.
- Do not guarantee rankings, traffic, leads, revenue, or citations.
- Keep language plain-English and business-focused.
- Every recommendation must cite evidence from scanner output, page assessment, profile, or observation data.
- Return valid JSON only.
```

### Output schema

```json
{
  "recommendations": [
    {
      "category": "string",
      "issueType": "string",
      "title": "string",
      "evidence": "string",
      "aiVisibilityImpact": "string",
      "businessImpact": "string",
      "recommendation": "string",
      "priorityScore": 0,
      "estimatedEffort": "low|medium|high",
      "owner": "business_owner|content_writer|developer|seo_specialist|agency",
      "fiverrPackageTier": "basic|standard|premium|custom",
      "thirtyDayActionStep": "string"
    }
  ]
}
```

## Prompt D — Generate report narrative

### System/developer instruction

```txt
Create a client-facing GEO/AEO AI Visibility Audit report narrative.

Audience:
Small business owner or Fiverr buyer.

Tone:
Clear, premium, practical, non-technical.

Use only approved canonical report data. Do not invent facts.

Must include:
- What AI visibility means
- Current AI Visibility Score
- Biggest blockers
- Competitor comparison if data exists
- Top AI-citable page opportunities
- FAQ/schema fixes
- Citation/source recommendations
- 30-day action plan
- Optional monthly monitoring upsell
- Disclaimer

Rules:
- Do not promise rankings, traffic, leads, revenue, or guaranteed AI citations.
- Label observations as snapshots.
- Keep recommendations practical.
- Return valid JSON or Markdown according to caller contract.
```

## Prompt E — Generate 30-day action plan

### System/developer instruction

```txt
Generate a 30-day GEO/AEO action plan from approved recommendations.

Rules:
- Use only approved recommendations.
- Group work by week.
- Prioritize high impact and low/medium effort first.
- Include owner and expected output.
- Do not guarantee outcomes.
- Return valid JSON only.
```

### Output schema

```json
{
  "weeks": [
    {
      "week": 1,
      "theme": "string",
      "actions": [
        {
          "title": "string",
          "owner": "string",
          "output": "string",
          "sourceRecommendationId": "string|null"
        }
      ]
    }
  ]
}
```

## Prompt F — Generate Fiverr delivery message

### System/developer instruction

```txt
Write a concise Fiverr delivery message for an AI Visibility Audit.

Use the supplied report summary only.
Do not make guarantees.
Mention what is attached/delivered.
Mention the 30-day action plan.
Optionally offer implementation or monthly monitoring as a soft upsell.
Keep it friendly and professional.
```

### Output example style

```txt
Hi {{clientName}}, your AI Visibility Audit is complete and attached.

I reviewed how your website is structured for ChatGPT, Gemini, Perplexity, and Google AI-style answer experiences, including entity clarity, answer coverage, page structure, proof signals, schema opportunities, competitor gaps, and citation/source readiness.

Your report includes your AI Visibility Score, top blockers, page-level recommendations, FAQ/schema fixes, AI-citable service page suggestions, and a 30-day action plan.

AI answers can vary by platform, prompt, location, and date, so this report focuses on practical readiness improvements rather than guaranteed placements.

The highest-priority next step is {{topNextStep}}.
```

---

# 4. Example service page recommendation format

```txt
Recommended URL:
/services/emergency-plumbing-austin

Recommended H1:
Emergency Plumbing in Austin, TX

Direct answer block:
{{Business Name}} provides emergency plumbing services in Austin for burst pipes, clogged drains, water heater issues, and urgent leak repairs. The company serves {{service areas}} and is best suited for {{target customers}}.

Recommended H2s:
- What emergency plumbing issues do we handle?
- How fast can we respond?
- Why choose us?
- Emergency plumbing pricing factors
- Areas served
- FAQs

Schema opportunities:
LocalBusiness
Service
FAQPage
BreadcrumbList

Proof blocks:
Reviews
Certifications
Years in business
Before/after examples
Warranty or guarantee
```

