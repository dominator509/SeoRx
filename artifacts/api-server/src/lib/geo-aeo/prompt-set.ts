import { getGeoPackageLimits } from "./packages";
import { geoAuditProfileInputSchema, type GeoAuditProfileInput, type GeoPromptItem } from "./schemas";

interface PromptTemplate {
  intent: GeoPromptItem["intent"];
  buyerStage: GeoPromptItem["buyerStage"];
  priority: number;
  build: (input: {
    businessName: string;
    service: string;
    location: string;
    competitor?: string;
    question?: string;
  }) => string;
}

const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    intent: "best_provider",
    buyerStage: "consideration",
    priority: 95,
    build: ({ service, location }) => `Who is the best ${service} provider in ${location}?`,
  },
  {
    intent: "local_service",
    buyerStage: "decision",
    priority: 92,
    build: ({ service, location }) => `Which companies offer ${service} near ${location}?`,
  },
  {
    intent: "trust_validation",
    buyerStage: "decision",
    priority: 88,
    build: ({ businessName, service }) => `Is ${businessName} a good option for ${service}?`,
  },
  {
    intent: "discovery",
    buyerStage: "awareness",
    priority: 84,
    build: ({ service, location }) => `What should I look for when choosing a ${service} company in ${location}?`,
  },
  {
    intent: "comparison",
    buyerStage: "consideration",
    priority: 82,
    build: ({ businessName, competitor, service }) => `Compare ${businessName} vs ${competitor ?? "other providers"} for ${service}.`,
  },
  {
    intent: "pricing",
    buyerStage: "consideration",
    priority: 78,
    build: ({ service, location }) => `How much does ${service} usually cost in ${location}?`,
  },
  {
    intent: "problem_solution",
    buyerStage: "awareness",
    priority: 74,
    build: ({ service }) => `What problems does a ${service} provider usually solve?`,
  },
  {
    intent: "faq",
    buyerStage: "consideration",
    priority: 70,
    build: ({ service }) => `What questions should I ask before hiring a ${service} provider?`,
  },
  {
    intent: "alternative",
    buyerStage: "consideration",
    priority: 66,
    build: ({ businessName, service }) => `What are the best alternatives to ${businessName} for ${service}?`,
  },
];

export function generateGeoPromptSet(input: {
  profile: GeoAuditProfileInput;
  maxPrompts?: number;
}): GeoPromptItem[] {
  const profile = geoAuditProfileInputSchema.parse(input.profile);
  const limits = getGeoPackageLimits(profile.packageTier);
  const maxPrompts = Math.min(input.maxPrompts ?? limits.maxPrompts, limits.maxPrompts);
  const businessName = profile.businessName;
  const services = nonEmpty(profile.targetServices, profile.primaryOffer ?? "service provider");
  const locations = nonEmpty(profile.targetLocations, "your area");
  const competitors = profile.competitors
    .map((competitor) => competitor.name?.trim())
    .filter((name): name is string => Boolean(name));

  const prompts: GeoPromptItem[] = [];

  for (const service of services) {
    for (const location of locations) {
      for (const template of PROMPT_TEMPLATES) {
        const competitor = competitors[0];
        prompts.push({
          promptText: template.build({ businessName, service, location, competitor }),
          intent: template.intent,
          targetService: service,
          targetLocation: location === "your area" ? undefined : location,
          buyerStage: template.buyerStage,
          priority: template.priority,
        });
      }
    }
  }

  for (const competitor of competitors) {
    for (const service of services) {
      prompts.push({
        promptText: `Compare ${businessName} vs ${competitor} for ${service}.`,
        intent: "comparison",
        targetService: service,
        buyerStage: "consideration",
        priority: 86,
      });
    }
  }

  for (const question of profile.customerQuestions) {
    prompts.push({
      promptText: question.endsWith("?") ? question : `${question}?`,
      intent: "faq",
      buyerStage: "consideration",
      priority: 72,
    });
  }

  return dedupePrompts(prompts)
    .sort((a, b) => b.priority - a.priority || a.promptText.localeCompare(b.promptText))
    .slice(0, maxPrompts);
}

function nonEmpty(values: string[] | undefined, fallback: string): string[] {
  const cleaned = (values ?? []).map((value) => value.trim()).filter(Boolean);
  return cleaned.length ? cleaned : [fallback];
}

function dedupePrompts(prompts: GeoPromptItem[]): GeoPromptItem[] {
  const seen = new Set<string>();
  const deduped: GeoPromptItem[] = [];
  for (const prompt of prompts) {
    const key = prompt.promptText.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(prompt);
  }
  return deduped;
}
