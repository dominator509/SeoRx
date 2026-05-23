import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type SmokeStatus = "PASS" | "SKIP" | "FAIL";

interface SmokeResult {
  name: string;
  status: SmokeStatus;
  detail: string;
}

const workspaceRoot = process.env.INIT_CWD ?? process.cwd();
const envFile = resolve(workspaceRoot, process.argv[2] ?? ".env.production.local");
const results: SmokeResult[] = [];

function loadEnvFile(path: string): void {
  if (!existsSync(path)) {
    throw new Error(`Env file not found: ${path}`);
  }

  const content = readFileSync(path, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function add(name: string, status: SmokeStatus, detail: string): void {
  results.push({ name, status, detail });
  const marker = status.padEnd(4);
  console.log(`${marker} ${name} - ${detail}`);
}

async function check(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
  } catch (err) {
    add(name, "FAIL", err instanceof Error ? err.message : String(err));
  }
}

function requireEnv(names: string[]): string[] {
  return names.filter((name) => !env(name));
}

function assertResponse(ok: boolean, status: number, service: string): void {
  if (!ok) {
    throw new Error(`${service} returned HTTP ${status}`);
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function stripeAuthHeader(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

loadEnvFile(envFile);
console.log(`Running live smoke checks with ${envFile}`);
console.log("Secrets are not printed by this script.\n");

await check("required core env", () => {
  const missing = requireEnv([
    "DATABASE_URL",
    "CLERK_PUBLISHABLE_KEY",
    "VITE_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "SESSION_SECRET",
    "ENCRYPTION_KEY",
    "ALLOWED_ORIGINS",
    "API_BASE_URL",
  ]);

  if (missing.length) {
    throw new Error(`Missing: ${missing.join(", ")}`);
  }

  if (env("CLERK_PUBLISHABLE_KEY") !== env("VITE_CLERK_PUBLISHABLE_KEY")) {
    throw new Error("CLERK_PUBLISHABLE_KEY and VITE_CLERK_PUBLISHABLE_KEY differ");
  }

  add("required core env", "PASS", "all required host-agnostic variables are present");
});

await check("database connectivity", async () => {
  const databaseUrl = env("DATABASE_URL");
  if (!databaseUrl) {
    add("database connectivity", "SKIP", "DATABASE_URL is not set");
    return;
  }

  const { pool } = await import("@workspace/db");
  const result = await pool.query<{ ok: number }>("select 1 as ok");
  await pool.end();

  if (result.rows[0]?.ok !== 1) {
    throw new Error("Database SELECT 1 returned an unexpected result");
  }

  add("database connectivity", "PASS", "Postgres accepted a read-only query");
});

await check("Clerk API credentials", async () => {
  const secretKey = env("CLERK_SECRET_KEY");
  if (!secretKey) {
    add("Clerk API credentials", "SKIP", "CLERK_SECRET_KEY is not set");
    return;
  }

  const response = await fetch("https://api.clerk.com/v1/instance", {
    headers: { Authorization: `Bearer ${secretKey}` },
    signal: AbortSignal.timeout(10000),
  });

  assertResponse(response.ok, response.status, "Clerk");
  add("Clerk API credentials", "PASS", "secret key can read Clerk instance metadata");
});

await check("Stripe API credentials", async () => {
  const secretKey = env("STRIPE_SECRET_KEY");
  if (!secretKey) {
    add("Stripe API credentials", "SKIP", "STRIPE_SECRET_KEY is not set");
    return;
  }

  const response = await fetch("https://api.stripe.com/v1/account", {
    headers: { Authorization: stripeAuthHeader(secretKey) },
    signal: AbortSignal.timeout(10000),
  });

  assertResponse(response.ok, response.status, "Stripe account");
  add("Stripe API credentials", "PASS", "secret key can read account metadata");
});

await check("Stripe price IDs", async () => {
  const secretKey = env("STRIPE_SECRET_KEY");
  const prices = [
    ["starter", env("STRIPE_PRICE_STARTER_MONTHLY")],
    ["professional", env("STRIPE_PRICE_PROFESSIONAL_MONTHLY")],
    ["enterprise", env("STRIPE_PRICE_ENTERPRISE_MONTHLY")],
  ] as const;

  if (!secretKey) {
    add("Stripe price IDs", "SKIP", "STRIPE_SECRET_KEY is not set");
    return;
  }

  const missing = prices.filter(([, priceId]) => !priceId).map(([plan]) => plan);
  if (missing.length) {
    const aliasHints = [
      env("STRIPE_PRICE_PRO_MONTHLY") ? "STRIPE_PRICE_PRO_MONTHLY should be STRIPE_PRICE_PROFESSIONAL_MONTHLY" : "",
      env("STRIPE_PRICE_AGENCY_MONTHLY") ? "STRIPE_PRICE_AGENCY_MONTHLY should be STRIPE_PRICE_ENTERPRISE_MONTHLY" : "",
    ].filter(Boolean);
    const hint = aliasHints.length ? ` (${aliasHints.join("; ")})` : "";
    throw new Error(`Missing price IDs for: ${missing.join(", ")}${hint}`);
  }

  for (const [plan, priceId] of prices) {
    const response = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
      headers: { Authorization: stripeAuthHeader(secretKey) },
      signal: AbortSignal.timeout(10000),
    });
    assertResponse(response.ok, response.status, `Stripe ${plan} price`);
  }

  add("Stripe price IDs", "PASS", "all configured monthly prices are readable");
});

await check("Stripe webhook secret", () => {
  const secret = env("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    add("Stripe webhook secret", "SKIP", "STRIPE_WEBHOOK_SECRET is not set");
    return;
  }
  if (!secret.startsWith("whsec_")) {
    throw new Error("STRIPE_WEBHOOK_SECRET should start with whsec_");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({ id: "evt_smoke", object: "event", type: "ping" });
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  if (!signature) {
    throw new Error("Could not generate a webhook test signature");
  }

  add("Stripe webhook secret", "PASS", "webhook signing secret has the expected shape");
});

await check("Google OAuth client", async () => {
  const clientId = env("GOOGLE_CLIENT_ID");
  const clientSecret = env("GOOGLE_CLIENT_SECRET");
  const apiBaseUrl = env("API_BASE_URL")?.replace(/\/$/, "");

  if (!clientId || !clientSecret || !apiBaseUrl) {
    add("Google OAuth client", "SKIP", "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or API_BASE_URL is not set");
    return;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: "seorx-live-smoke-invalid-code",
    grant_type: "authorization_code",
    redirect_uri: `${apiBaseUrl}/api/integrations/gsc/callback`,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10000),
  });
  const data = await readJson(response) as { error?: string } | null;

  if (data?.error === "invalid_grant") {
    add("Google OAuth client", "PASS", "OAuth client credentials were accepted; invalid test code was rejected");
    return;
  }

  throw new Error(`OAuth token endpoint returned ${data?.error ?? `HTTP ${response.status}`}`);
});

await check("PageSpeed API", async () => {
  const key = env("PAGESPEED_API_KEY");
  if (!key) {
    add("PageSpeed API", "SKIP", "PAGESPEED_API_KEY is not set");
    return;
  }

  const url = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  url.searchParams.set("url", env("LIVE_SMOKE_URL") ?? "https://example.com");
  url.searchParams.set("strategy", "desktop");
  url.searchParams.set("category", "seo");
  url.searchParams.set("key", key);

  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  assertResponse(response.ok, response.status, "PageSpeed");
  const data = await readJson(response) as {
    lighthouseResult?: { categories?: { seo?: { score?: number } } };
  } | null;

  if (typeof data?.lighthouseResult?.categories?.seo?.score !== "number") {
    throw new Error("PageSpeed response did not include an SEO score");
  }

  add("PageSpeed API", "PASS", "one desktop SEO-only PageSpeed request completed");
});

await check("OpenAI API credentials", async () => {
  const key = env("OPENAI_API_KEY");
  if (!key) {
    add("OpenAI API credentials", "SKIP", "OPENAI_API_KEY is not set");
    return;
  }

  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10000),
  });

  assertResponse(response.ok, response.status, "OpenAI models");
  add("OpenAI API credentials", "PASS", "key can list available models without generation");
});

await check("Anthropic API credentials", async () => {
  const key = env("ANTHROPIC_API_KEY");
  if (!key) {
    add("Anthropic API credentials", "SKIP", "ANTHROPIC_API_KEY is not set");
    return;
  }

  const response = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    signal: AbortSignal.timeout(10000),
  });

  assertResponse(response.ok, response.status, "Anthropic models");
  add("Anthropic API credentials", "PASS", "key can list available models without generation");
});

await check("Gemini API credentials", async () => {
  const key = env("GEMINI_API_KEY");
  if (!key) {
    add("Gemini API credentials", "SKIP", "GEMINI_API_KEY is not set");
    return;
  }

  const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
  url.searchParams.set("key", key);
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

  assertResponse(response.ok, response.status, "Gemini models");
  add("Gemini API credentials", "PASS", "key can list available models without generation");
});

const failed = results.filter((result) => result.status === "FAIL");
const skipped = results.filter((result) => result.status === "SKIP");
const passed = results.filter((result) => result.status === "PASS");

console.log(`\nSummary: ${passed.length} passed, ${skipped.length} skipped, ${failed.length} failed.`);

if (failed.length) {
  process.exitCode = 1;
}
