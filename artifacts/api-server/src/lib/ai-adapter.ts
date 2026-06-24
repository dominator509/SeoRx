import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db, aiProvidersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";
import type { SeoIssue } from "./seo-analyzer";
import { decryptSecret } from "./crypto";

export interface AiProviderConfig {
  id: string;
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export async function getActiveProvider(orgId?: string): Promise<AiProviderConfig | null> {
  const conditions = [eq(aiProvidersTable.isActive, true)];
  if (orgId) conditions.push(eq(aiProvidersTable.orgId, orgId));

  const provider = await db.query.aiProvidersTable.findFirst({
    where: and(...conditions, eq(aiProvidersTable.isDefault, true)),
  }) ?? await db.query.aiProvidersTable.findFirst({
    where: and(...conditions),
  });

  if (!provider) return null;

  return {
    id: provider.id,
    provider: provider.provider,
    model: provider.model,
    apiKey: provider.encryptedApiKey ? (decryptSecret(provider.encryptedApiKey) ?? undefined) : undefined,
    baseUrl: provider.baseUrl ?? undefined,
  };
}

const SYSTEM_PROMPT = `You are an expert SEO consultant with 15+ years of experience. 
You provide concise, actionable, and technically precise recommendations for SEO issues. 
Your responses are always specific to the issue at hand and include concrete next steps.
Keep each recommendation under 200 words. Be direct — no generic advice.`;

async function callOpenAI(config: AiProviderConfig, prompt: string, systemPrompt = SYSTEM_PROMPT): Promise<string> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || undefined,
  });
  const resp = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    max_tokens: 300,
    temperature: 0.4,
  });
  return resp.choices[0]?.message?.content?.trim() ?? "";
}

async function callAnthropic(config: AiProviderConfig, prompt: string, systemPrompt = SYSTEM_PROMPT): Promise<string> {
  const client = new Anthropic({ apiKey: config.apiKey });
  const resp = await client.messages.create({
    model: config.model,
    max_tokens: 300,
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
  });
  const block = resp.content[0];
  return block?.type === "text" ? block.text.trim() : "";
}

async function callGemini(config: AiProviderConfig, prompt: string, systemPrompt = SYSTEM_PROMPT): Promise<string> {
  const genAI = new GoogleGenerativeAI(config.apiKey ?? "");
  const model = genAI.getGenerativeModel({ model: config.model });
  const result = await model.generateContent(`${systemPrompt}\n\n${prompt}`);
  return result.response.text().trim();
}

async function callOllama(config: AiProviderConfig, prompt: string, systemPrompt = SYSTEM_PROMPT): Promise<string> {
  const baseUrl = (config.baseUrl ?? "http://localhost:11434").replace(/\/$/, "");
  const resp = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      stream: false,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!resp.ok) throw new Error(`Ollama error: ${resp.status}`);
  const data = await resp.json() as any;
  return data?.message?.content?.trim() ?? "";
}

export async function generateAiRecommendation(
  issue: SeoIssue,
  siteUrl: string,
  config: AiProviderConfig,
): Promise<string> {
  const prompt = `SEO Issue on ${siteUrl}:

Category: ${issue.category}
Severity: ${issue.severity}
Issue: ${issue.title}
Description: ${issue.description}
Current recommendation: ${issue.recommendation}
${issue.affectedElement ? `Affected URLs/elements: ${issue.affectedElement}` : ""}

Provide a specific, actionable AI-enhanced recommendation that builds on the current advice. Include any technical implementation details, specific code snippets if helpful, estimated impact, and effort level (Low/Medium/High).`;

  try {
    return await generateAiText(config, prompt);
  } catch (err) {
    logger.error({ err, provider: config.provider }, "AI recommendation failed");
    return "";
  }
}

export async function generateAiText(
  config: AiProviderConfig,
  prompt: string,
  systemPrompt = SYSTEM_PROMPT,
): Promise<string> {
  switch (config.provider) {
    case "openai":
    case "custom":
      return await callOpenAI(config, prompt, systemPrompt);
    case "anthropic":
      return await callAnthropic(config, prompt, systemPrompt);
    case "gemini":
      return await callGemini(config, prompt, systemPrompt);
    case "ollama":
      return await callOllama(config, prompt, systemPrompt);
    default:
      return await callOpenAI(config, prompt, systemPrompt);
  }
}

export async function generateBatchRecommendations(
  issues: SeoIssue[],
  siteUrl: string,
  config: AiProviderConfig,
  maxIssues = 10,
): Promise<Map<number, string>> {
  const results = new Map<number, string>();
  const topIssues = issues
    .slice()
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, maxIssues);

  for (let i = 0; i < topIssues.length; i++) {
    const issue = topIssues[i];
    const originalIndex = issues.indexOf(issue);
    try {
      const rec = await generateAiRecommendation(issue, siteUrl, config);
      if (rec) results.set(originalIndex, rec);
    } catch (err) {
      logger.warn({ err, issueTitle: issue.title }, "Skipping AI recommendation for issue");
    }
    // Small delay between AI calls to avoid rate limits
    if (i < topIssues.length - 1) await new Promise((r) => setTimeout(r, 500));
  }

  return results;
}
