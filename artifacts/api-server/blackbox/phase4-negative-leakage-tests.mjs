import fs from "node:fs";
import path from "node:path";
import { req } from "./http-client.mjs";

const baseUrl = process.env.BLACKBOX_BASE_URL ?? "http://127.0.0.1:4000/api";
const outDir = path.join(process.cwd(), "artifacts", "api-server", "blackbox", "reports");
fs.mkdirSync(outDir, { recursive: true });

const probes = [];

probes.push(await req(baseUrl, "POST", "/organizations", { body: "{bad-json", headers: { "Content-Type": "application/json" } }));
probes.push(await req(baseUrl, "POST", "/organizations", { body: "<xml></xml>", headers: { "Content-Type": "application/xml" } }));
probes.push(await req(baseUrl, "GET", "/auth/me", { headers: { Authorization: "Bearer invalid.invalid.invalid" } }));
probes.push(await req(baseUrl, "PUT", "/issues/not-a-real-id/approve", { body: { notes: "x" } }));

function leaked(text) {
  const t = (text || "").toLowerCase();
  return ["stack", "at ", "drizzle", "postgres", "sqlite", "express", "node_modules", "traceback"].some((s) => t.includes(s));
}

const results = probes.map((p, i) => ({
  id: i + 1,
  status: p.status,
  elapsedMs: p.elapsedMs,
  leaked: leaked(p.text),
  bodyPreview: (p.text || "").slice(0, 300)
}));

fs.writeFileSync(path.join(outDir, "phase4-results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));

if (results.some((r) => r.leaked)) process.exitCode = 1;
