import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type Level = "PASS" | "WARN" | "FAIL";

interface CheckResult {
  level: Level;
  name: string;
  detail: string;
}

const workspaceRoot = process.env.INIT_CWD ?? process.cwd();
const envFileArg = process.argv.slice(2).find((arg) => arg !== "--");
const envFile = resolve(workspaceRoot, envFileArg ?? ".env.production.local");
const values = new Map<string, string>();
const results: CheckResult[] = [];

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
    values.set(key, value);
  }
}

function env(name: string): string | undefined {
  const value = values.get(name)?.trim();
  return value ? value : undefined;
}

function add(level: Level, name: string, detail: string): void {
  results.push({ level, name, detail });
  console.log(`${level.padEnd(4)} ${name} - ${detail}`);
}

function has(name: string): boolean {
  return Boolean(env(name));
}

function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function checkRequired(names: string[]): void {
  const missing = names.filter((name) => !has(name));
  if (missing.length) {
    add("FAIL", "required variables", `missing ${missing.join(", ")}`);
    return;
  }
  add("PASS", "required variables", "all required deployment variables are present");
}

function checkUrlList(name: string): void {
  const raw = env(name);
  if (!raw) return;
  const origins = raw.split(",").map((origin) => origin.trim()).filter(Boolean);
  const invalid = origins.filter((origin) => !isUrl(origin));
  if (invalid.length) {
    add("FAIL", name, "contains origins that are not valid http(s) URLs");
    return;
  }
  if (origins.some((origin) => origin === "*" || origin.includes("*"))) {
    add("FAIL", name, "wildcard origins are not safe for production");
    return;
  }
  add("PASS", name, `${origins.length} explicit origin(s) configured`);
}

function checkOptionalPair(name: string, first: string, second: string): void {
  if (has(first) === has(second)) {
    if (has(first)) add("PASS", name, "both variables are present");
    return;
  }
  add("WARN", name, `${first} and ${second} should be configured together`);
}

function checkPrefix(name: string, prefixes: string[], severity: Level = "FAIL"): void {
  const value = env(name);
  if (!value) return;
  if (!prefixes.some((prefix) => value.startsWith(prefix))) {
    add(severity, name, `expected prefix ${prefixes.join(" or ")}`);
  }
}

function checkLength(name: string, minimum: number): void {
  const value = env(name);
  if (!value) return;
  if (value.length < minimum) {
    add("WARN", name, `value should be at least ${minimum} characters`);
  }
}

function checkBooleanFlag(name: string): void {
  const value = env(name);
  if (!value) return;
  if (value !== "true" && value !== "false") {
    add("FAIL", name, "must be true or false");
  }
}

function checkPositiveInteger(name: string): void {
  const value = env(name);
  if (!value) return;
  if (!/^\d+$/.test(value) || Number(value) <= 0) {
    add("FAIL", name, "must be a positive integer");
  }
}

function checkKnownAliases(): void {
  const aliases = [
    ["STRIPE_PRICE_PRO_MONTHLY", "STRIPE_PRICE_PROFESSIONAL_MONTHLY"],
    ["STRIPE_PRICE_AGENCY_MONTHLY", "STRIPE_PRICE_ENTERPRISE_MONTHLY"],
  ] as const;

  for (const [alias, canonical] of aliases) {
    if (has(alias)) {
      add("FAIL", alias, `use ${canonical} instead`);
    }
  }
}

loadEnvFile(envFile);
console.log(`Checking deployment env shape for ${envFile}`);
console.log("Secret values are not printed by this script.\n");

checkRequired([
  "DATABASE_URL",
  "CLERK_PUBLISHABLE_KEY",
  "VITE_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "SESSION_SECRET",
  "ALLOWED_ORIGINS",
]);

checkKnownAliases();
checkPrefix("DATABASE_URL", ["postgres://", "postgresql://"]);
checkPrefix("CLERK_PUBLISHABLE_KEY", ["pk_test_", "pk_live_"]);
checkPrefix("VITE_CLERK_PUBLISHABLE_KEY", ["pk_test_", "pk_live_"]);
checkPrefix("CLERK_SECRET_KEY", ["sk_test_", "sk_live_"]);

if (env("CLERK_PUBLISHABLE_KEY") && env("VITE_CLERK_PUBLISHABLE_KEY") &&
  env("CLERK_PUBLISHABLE_KEY") !== env("VITE_CLERK_PUBLISHABLE_KEY")) {
  add("FAIL", "Clerk publishable key", "backend and Vite publishable key values differ");
}

checkLength("SESSION_SECRET", 32);
checkLength("ENCRYPTION_KEY", 32);
checkUrlList("ALLOWED_ORIGINS");

const apiBaseUrl = env("API_BASE_URL");
if (apiBaseUrl && !isUrl(apiBaseUrl)) {
  add("FAIL", "API_BASE_URL", "must be a valid http(s) URL");
}

const port = env("PORT");
if (port && (!/^\d+$/.test(port) || Number(port) <= 0)) {
  add("FAIL", "PORT", "must be a positive integer");
}

const basePath = env("BASE_PATH");
if (basePath && !basePath.startsWith("/")) {
  add("FAIL", "BASE_PATH", "must start with /");
}

checkOptionalPair("Google Search Console OAuth", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET");

for (const name of [
  "GEO_AEO_ENABLED",
  "GEO_AEO_REAL_PLATFORM_CHECKS",
  "GEO_AEO_MANUAL_OBSERVATIONS",
]) {
  checkBooleanFlag(name);
}

for (const name of [
  "GEO_AEO_DEFAULT_PROMPT_COUNT",
  "GEO_AEO_MAX_COMPETITORS",
  "GEO_AEO_MAX_PAGES_BASIC",
  "GEO_AEO_MAX_PAGES_STANDARD",
  "GEO_AEO_MAX_PAGES_PREMIUM",
]) {
  checkPositiveInteger(name);
}

if (has("STRIPE_SECRET_KEY")) {
  checkPrefix("STRIPE_SECRET_KEY", ["sk_test_", "sk_live_"]);
  for (const name of [
    "STRIPE_PRICE_STARTER_MONTHLY",
    "STRIPE_PRICE_PROFESSIONAL_MONTHLY",
    "STRIPE_PRICE_ENTERPRISE_MONTHLY",
  ]) {
    checkPrefix(name, ["price_"]);
  }
  checkPrefix("STRIPE_WEBHOOK_SECRET", ["whsec_"], "WARN");
}

const failures = results.filter((result) => result.level === "FAIL");
const warnings = results.filter((result) => result.level === "WARN");
const passes = results.filter((result) => result.level === "PASS");

console.log(`\nSummary: ${passes.length} passed, ${warnings.length} warned, ${failures.length} failed.`);

if (failures.length) {
  process.exitCode = 1;
}
