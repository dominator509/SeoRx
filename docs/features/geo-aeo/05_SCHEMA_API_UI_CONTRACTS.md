# GEO/AEO Schema, API, UI, and Service Contracts

This file provides target contracts. Codex must adapt names and paths to the actual SEORx repository.

## 1. Suggested enums

Use existing enum style if different.

```prisma
enum AuditType {
  SEO_LEAK
  GEO_AEO
  HYBRID
}

enum ReportType {
  SEO_AUDIT
  GEO_AEO_AUDIT
  HYBRID_AUDIT
  RETAINER_PROPOSAL
}

enum AiVisibilitySurface {
  CHATGPT
  GEMINI
  PERPLEXITY
  GOOGLE_AI_OVERVIEWS
  GOOGLE_AI_MODE
  COPILOT
  CLAUDE
  MANUAL_OBSERVATION
  SIMULATED_RETRIEVAL
}

enum GeoPromptIntent {
  DISCOVERY
  LOCAL_SERVICE
  COMPARISON
  BEST_PROVIDER
  PRICING
  PROBLEM_SOLUTION
  FAQ
  ALTERNATIVE
  TRUST_VALIDATION
}
```

If existing audit/report type systems are string constants rather than Prisma enums, follow the existing pattern.

## 2. Suggested Prisma models

Only add these if the repo does not already have suitable generic audit metadata, issue evidence, report payload, observation, or recommendation models.

```prisma
model GeoAuditProfile {
  id                 String   @id @default(cuid())
  auditRunId          String   @unique
  businessName        String
  websiteUrl          String
  primaryOffer        String?
  targetLocationsJson Json?
  targetServicesJson  Json?
  targetCustomersJson Json?
  competitorsJson     Json?
  proofPointsJson     Json?
  reviewsUrl          String?
  googleBusinessUrl   String?
  importantPagesJson  Json?
  customerQuestionsJson Json?
  knownFor            String?
  packageTier         String   @default("standard")
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}

model GeoPrompt {
  id             String          @id @default(cuid())
  auditRunId      String
  promptText      String
  intent          GeoPromptIntent
  targetService   String?
  targetLocation  String?
  buyerStage      String?
  priority        Int             @default(50)
  approved        Boolean         @default(false)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}

model GeoVisibilityObservation {
  id                       String              @id @default(cuid())
  auditRunId                String
  promptId                  String?
  surface                   AiVisibilitySurface
  observedAt                DateTime            @default(now())
  brandMentioned            Boolean             @default(false)
  brandCited                Boolean             @default(false)
  brandPosition             Int?
  sentiment                 String?
  answerSummary             String?
  citedUrlsJson             Json?
  competitorsMentionedJson  Json?
  rawAnswerExcerpt          String?
  confidenceScore           Int                 @default(50)
  notes                     String?
  approved                  Boolean             @default(false)
  createdAt                 DateTime            @default(now())
  updatedAt                 DateTime            @updatedAt
}

model GeoPageAssessment {
  id                       String   @id @default(cuid())
  auditRunId                String
  pageUrl                   String
  aiCitableScore            Int
  answerCoverageScore       Int
  entityClarityScore        Int
  proofSignalScore          Int
  structureScore            Int
  schemaReadinessScore      Int
  citationReadinessScore    Int
  detectedGapsJson          Json?
  recommendedFixesJson      Json?
  evidenceJson              Json?
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt
}

model GeoRecommendation {
  id                String   @id @default(cuid())
  auditRunId         String
  pageUrl            String?
  category           String
  issueType          String
  title              String
  evidence           String
  recommendation     String
  aiVisibilityImpact String?
  businessImpact     String?
  priorityScore      Int
  estimatedEffort    String?
  owner              String?
  fiverrPackageTier  String?
  status             String   @default("DRAFT")
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```

## 3. TypeScript domain types

Suggested types:

```ts
export type GeoPackageTier = "basic" | "standard" | "premium" | "custom";

export interface GeoAuditProfileInput {
  businessName: string;
  websiteUrl: string;
  primaryOffer?: string;
  targetLocations?: string[];
  targetServices?: string[];
  targetCustomers?: string[];
  competitors?: Array<{ name?: string; url: string }>;
  proofPoints?: string[];
  reviewsUrl?: string;
  googleBusinessUrl?: string;
  importantPages?: string[];
  customerQuestions?: string[];
  knownFor?: string;
  packageTier: GeoPackageTier;
}

export interface GeoPromptItem {
  id?: string;
  promptText: string;
  intent: GeoPromptIntent;
  targetService?: string;
  targetLocation?: string;
  buyerStage?: string;
  priority: number;
}

export interface GeoVisibilityObservationInput {
  promptId?: string;
  surface: AiVisibilitySurface;
  observedAt?: string;
  brandMentioned: boolean;
  brandCited: boolean;
  brandPosition?: number;
  sentiment?: "positive" | "neutral" | "negative" | "mixed" | "unknown";
  answerSummary?: string;
  citedUrls?: string[];
  competitorsMentioned?: string[];
  rawAnswerExcerpt?: string;
  confidenceScore: number;
  notes?: string;
}

export interface GeoScorePayload {
  aiVisibilityScore: number;
  grade: "Excellent" | "Strong" | "Moderate" | "Needs Work" | "Critical";
  subscores: {
    answerCoverage: number;
    entityClarity: number;
    citableStructure: number;
    proofAndSourceability: number;
    schemaReadiness: number;
    crawlability: number;
    competitorGap: number;
    localDataCompleteness: number;
  };
  topRisks: string[];
  quickWins: string[];
  summary: string;
}
```

## 4. Suggested Zod schemas

Adapt to repo schema style.

```ts
import { z } from "zod";

export const geoPackageTierSchema = z.enum(["basic", "standard", "premium", "custom"]);

export const geoCompetitorSchema = z.object({
  name: z.string().trim().max(120).optional(),
  url: z.string().url()
});

export const geoAuditProfileInputSchema = z.object({
  businessName: z.string().trim().min(1).max(200),
  websiteUrl: z.string().url(),
  primaryOffer: z.string().trim().max(300).optional(),
  targetLocations: z.array(z.string().trim().max(120)).max(25).default([]),
  targetServices: z.array(z.string().trim().max(160)).max(50).default([]),
  targetCustomers: z.array(z.string().trim().max(160)).max(50).default([]),
  competitors: z.array(geoCompetitorSchema).max(10).default([]),
  proofPoints: z.array(z.string().trim().max(300)).max(50).default([]),
  reviewsUrl: z.string().url().optional().or(z.literal("")),
  googleBusinessUrl: z.string().url().optional().or(z.literal("")),
  importantPages: z.array(z.string().url()).max(50).default([]),
  customerQuestions: z.array(z.string().trim().max(300)).max(100).default([]),
  knownFor: z.string().trim().max(300).optional(),
  packageTier: geoPackageTierSchema.default("standard")
});

export const geoVisibilityObservationInputSchema = z.object({
  promptId: z.string().optional(),
  surface: z.enum([
    "CHATGPT",
    "GEMINI",
    "PERPLEXITY",
    "GOOGLE_AI_OVERVIEWS",
    "GOOGLE_AI_MODE",
    "COPILOT",
    "CLAUDE",
    "MANUAL_OBSERVATION",
    "SIMULATED_RETRIEVAL"
  ]),
  observedAt: z.string().datetime().optional(),
  brandMentioned: z.boolean().default(false),
  brandCited: z.boolean().default(false),
  brandPosition: z.number().int().positive().optional(),
  sentiment: z.enum(["positive", "neutral", "negative", "mixed", "unknown"]).default("unknown"),
  answerSummary: z.string().max(2000).optional(),
  citedUrls: z.array(z.string().url()).max(50).default([]),
  competitorsMentioned: z.array(z.string().trim().max(200)).max(50).default([]),
  rawAnswerExcerpt: z.string().max(5000).optional(),
  confidenceScore: z.number().int().min(0).max(100).default(50),
  notes: z.string().max(2000).optional()
});
```

## 5. Service interfaces

### Package service

```ts
export interface GeoPackageLimits {
  tier: GeoPackageTier;
  maxPages: number;
  maxPrompts: number;
  maxCompetitors: number;
  reportSections: string[];
}

export interface GeoPackageService {
  getLimits(tier: GeoPackageTier): GeoPackageLimits;
  assertWithinLimits(input: {
    tier: GeoPackageTier;
    pageCount?: number;
    promptCount?: number;
    competitorCount?: number;
  }): void;
}
```

### Prompt-set service

```ts
export interface GeoPromptSetService {
  generatePromptSet(input: {
    auditRunId: string;
    profile: GeoAuditProfileInput;
    maxPrompts: number;
    useAi?: boolean;
  }): Promise<GeoPromptItem[]>;
}
```

### Observation service

```ts
export interface GeoObservationService {
  createObservation(input: {
    tenantId: string;
    userId: string;
    auditRunId: string;
    observation: GeoVisibilityObservationInput;
  }): Promise<void>;

  listObservations(input: {
    tenantId: string;
    auditRunId: string;
    approvedOnly?: boolean;
  }): Promise<unknown[]>;
}
```

### Scoring service

```ts
export interface GeoScoringService {
  calculateScore(input: {
    auditRunId: string;
    pageAssessments: unknown[];
    recommendations: unknown[];
    observations?: unknown[];
  }): Promise<GeoScorePayload>;
}
```

### Report service

```ts
export interface GeoReportService {
  buildCanonicalPayload(input: {
    tenantId: string;
    auditRunId: string;
    approvedOnly: boolean;
  }): Promise<GeoReportPayload>;
}
```

## 6. API route contracts

Adapt to actual App Router/API conventions.

### Create/update profile

```txt
POST /api/audits/:auditId/geo/profile
```

Request:

```json
{
  "businessName": "Example Plumbing",
  "websiteUrl": "https://example.com",
  "primaryOffer": "Emergency plumbing",
  "targetLocations": ["Austin, TX"],
  "targetServices": ["Burst pipe repair", "Water heater repair"],
  "targetCustomers": ["Homeowners", "Property managers"],
  "competitors": [{ "name": "Competitor", "url": "https://competitor.example" }],
  "proofPoints": ["Licensed", "24/7 service", "500+ reviews"],
  "packageTier": "standard"
}
```

Response:

```json
{
  "ok": true,
  "profileId": "..."
}
```

### Generate prompts

```txt
POST /api/audits/:auditId/geo/prompts/generate
```

Request:

```json
{
  "useAi": false,
  "replaceExisting": false
}
```

Response:

```json
{
  "ok": true,
  "prompts": []
}
```

### Add observation

```txt
POST /api/audits/:auditId/geo/observations
```

Request:

```json
{
  "surface": "CHATGPT",
  "promptId": "...",
  "brandMentioned": true,
  "brandCited": false,
  "sentiment": "neutral",
  "answerSummary": "The answer mentioned the business but did not cite its website.",
  "citedUrls": [],
  "competitorsMentioned": ["Competitor A"],
  "confidenceScore": 70
}
```

### Calculate score

```txt
POST /api/audits/:auditId/geo/score
```

Response:

```json
{
  "ok": true,
  "score": {
    "aiVisibilityScore": 62,
    "grade": "Needs Work",
    "subscores": {}
  }
}
```

### Generate report

```txt
POST /api/reports/:auditId/generate?type=GEO_AEO_AUDIT
```

Response:

```json
{
  "ok": true,
  "reportId": "...",
  "status": "DRAFT"
}
```

## 7. Admin UI components

Suggested components:

```txt
components/geo/GeoAuditTypeSelector.tsx
components/geo/GeoIntakeForm.tsx
components/geo/GeoPackageLimitsCard.tsx
components/geo/GeoPromptSetEditor.tsx
components/geo/GeoObservationForm.tsx
components/geo/GeoVisibilityScoreCard.tsx
components/geo/GeoPageAssessmentTable.tsx
components/geo/GeoRecommendationReview.tsx
components/geo/GeoFiverrFulfillmentChecklist.tsx
components/geo/GeoReportPreview.tsx
```

## 8. Admin UI states

Every admin page should handle:

```txt
feature disabled
loading
empty profile
validation error
package limit exceeded
crawler/scanner pending
AI generation failed
report draft
report approved
export failed
```

## 9. Client UI states

Client-facing GEO/AEO UI should handle:

```txt
no approved report
unlicensed/no access
latest report available
monitoring not enabled
score unavailable
score trend unavailable
```

## 10. Audit logs

Audit log events should be added using repo conventions for:

```txt
GEO profile created/updated
prompt set generated
manual observation added/updated/deleted
GEO scan started/completed/failed
AI visibility score calculated
recommendations generated
recommendation approved/hidden/edited
report generated/approved/exported
```

