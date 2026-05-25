import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const root = process.cwd();
const specPath = path.join(root, "lib", "api-spec", "openapi.yaml");
const outDir = path.join(root, "artifacts", "api-server", "blackbox", "reports");
fs.mkdirSync(outDir, { recursive: true });

const spec = yaml.load(fs.readFileSync(specPath, "utf8"));
const map = [];

for (const [route, methods] of Object.entries(spec.paths ?? {})) {
  for (const [method, op] of Object.entries(methods)) {
    map.push({
      method: method.toUpperCase(),
      path: `/api${route}`,
      operationId: op.operationId ?? null,
      auth: Array.isArray(op.security) && op.security.length > 0 ? "bearerAuth" : "none",
      requestBodyContentTypes: Object.keys(op.requestBody?.content ?? {}),
      responses: Object.keys(op.responses ?? {}),
      tags: op.tags ?? []
    });
  }
}

map.sort((a, b) => `${a.path}:${a.method}`.localeCompare(`${b.path}:${b.method}`));
fs.writeFileSync(path.join(outDir, "EXTERNAL_INTERFACE_MAP.json"), JSON.stringify(map, null, 2));

const lines = ["# EXTERNAL_INTERFACE_MAP", "", "| Method | Path | Auth | Req Body | Responses |", "|---|---|---|---|---|"];
for (const e of map) {
  lines.push(`| ${e.method} | ${e.path} | ${e.auth} | ${e.requestBodyContentTypes.join(", ") || "-"} | ${e.responses.join(", ") || "-"} |`);
}
const mdPath = path.join(outDir, "EXTERNAL_INTERFACE_MAP.md");
fs.writeFileSync(mdPath, `${lines.join("\n")}\n`);
console.log(lines.join("\n"));
