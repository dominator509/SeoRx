import fs from "node:fs";
import path from "node:path";
import { req } from "./http-client.mjs";

const baseUrl = process.env.BLACKBOX_BASE_URL ?? "http://127.0.0.1:4000/api";
const bearer = process.env.BLACKBOX_BEARER_TOKEN;
const outDir = path.join(process.cwd(), "artifacts", "api-server", "blackbox", "reports");
fs.mkdirSync(outDir, { recursive: true });

const headers = bearer ? { Authorization: `Bearer ${bearer}` } : {};
const flow = [];

const me = await req(baseUrl, "GET", "/auth/me", { headers });
flow.push({ step: "GET /auth/me", status: me.status });

const orgCreate = await req(baseUrl, "POST", "/organizations", {
  headers,
  body: { name: "Blackbox Org", slug: `blackbox-${Date.now()}` }
});
flow.push({ step: "POST /organizations", status: orgCreate.status });
const orgId = orgCreate.json?.id;

if (orgId) {
  const orgGet = await req(baseUrl, "GET", `/organizations/${orgId}`, { headers });
  flow.push({ step: "GET /organizations/{id}", status: orgGet.status, orgId });
}

const clientCreate = await req(baseUrl, "POST", "/clients", {
  headers,
  body: { orgId: orgId ?? "missing-org", name: "Blackbox Client", domain: "example.com" }
});
flow.push({ step: "POST /clients", status: clientCreate.status });
const clientId = clientCreate.json?.id;

if (clientId) {
  const auditCreate = await req(baseUrl, "POST", "/audits", {
    headers,
    body: { clientId, url: "https://example.com" }
  });
  flow.push({ step: "POST /audits", status: auditCreate.status, clientId });
}

fs.writeFileSync(path.join(outDir, "phase3-results.json"), JSON.stringify(flow, null, 2));
console.log(JSON.stringify(flow, null, 2));
