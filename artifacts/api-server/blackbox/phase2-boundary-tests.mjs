import fs from "node:fs";
import path from "node:path";
import { req } from "./http-client.mjs";

const baseUrl = process.env.BLACKBOX_BASE_URL ?? "http://127.0.0.1:4000/api";
const outDir = path.join(process.cwd(), "artifacts", "api-server", "blackbox", "reports");
fs.mkdirSync(outDir, { recursive: true });

const tests = [
  { name: "healthz baseline", method: "GET", path: "/healthz", expect: [200] },
  { name: "auth required on /auth/me", method: "GET", path: "/auth/me", expect: [401] },
  { name: "create org missing required fields", method: "POST", path: "/organizations", body: {}, expect: [400, 401, 422] },
  { name: "create org boundary long fields", method: "POST", path: "/organizations", body: { name: "a".repeat(4096), slug: "s".repeat(4096) }, expect: [400, 401, 413, 422] },
  { name: "create audit invalid URI + negative maxPages", method: "POST", path: "/audits", body: { clientId: "x", url: "not-a-uri", maxPages: -1 }, expect: [400, 401, 422] },
  { name: "list audits limit min boundary", method: "GET", path: "/audits?limit=0&offset=0", expect: [200, 400, 401, 422] },
  { name: "list audits limit max int boundary", method: "GET", path: "/audits?limit=2147483647&offset=0", expect: [200, 400, 401, 413, 422] }
];

const results = [];
for (const t of tests) {
  const r = await req(baseUrl, t.method, t.path, { body: t.body });
  const ok = t.expect.includes(r.status);
  results.push({ ...t, status: r.status, elapsedMs: r.elapsedMs, ok });
}

fs.writeFileSync(path.join(outDir, "phase2-results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  process.exitCode = 1;
}
