import fs from "node:fs";
import path from "node:path";

const outDir = path.join(process.cwd(), "artifacts", "api-server", "blackbox", "reports");
const map = JSON.parse(fs.readFileSync(path.join(outDir, "EXTERNAL_INTERFACE_MAP.json"), "utf8"));
const p2 = JSON.parse(fs.readFileSync(path.join(outDir, "phase2-results.json"), "utf8"));
const p3 = JSON.parse(fs.readFileSync(path.join(outDir, "phase3-results.json"), "utf8"));
const p4 = JSON.parse(fs.readFileSync(path.join(outDir, "phase4-results.json"), "utf8"));

const testedPaths = new Set();
for (const t of p2) testedPaths.add(t.path);
if (p3.find((x) => x.step.includes("/auth/me"))) testedPaths.add("/auth/me");
if (p3.find((x) => x.step.includes("/organizations"))) testedPaths.add("/organizations");
if (p3.find((x) => x.step.includes("/clients"))) testedPaths.add("/clients");
if (p3.find((x) => x.step.includes("/audits"))) testedPaths.add("/audits");
testedPaths.add("/issues/not-a-real-id/approve");

const totalEndpoints = map.length;
const uniqueDocumentedPaths = new Set(map.map((m) => m.path.replace("/api", "")));
const coverage = Math.round((testedPaths.size / uniqueDocumentedPaths.size) * 10000) / 100;

const leakageFailures = p4.filter((r) => r.leaked);
const unexpectedPhase2 = p2.filter((r) => !r.ok);

const md = `# BLACK_BOX_CONTRACT_REPORT

- Generated: ${new Date().toISOString()}
- Documented operations: ${totalEndpoints}
- Documented endpoint paths: ${uniqueDocumentedPaths.size}
- Tested endpoint paths: ${testedPaths.size}
- Endpoint path coverage: ${coverage}%

## Phase Results

### Phase 2 (Equivalence/Boundary)
- Total test cases: ${p2.length}
- Unexpected responses: ${unexpectedPhase2.length}

### Phase 3 (State/Workflow)
- Steps executed: ${p3.length}
- Auth token provided: ${process.env.BLACKBOX_BEARER_TOKEN ? "yes" : "no"}

### Phase 4 (Negative/Leakage)
- Probes executed: ${p4.length}
- Leakage findings: ${leakageFailures.length}

## Deviations and Unhandled Exceptions

${unexpectedPhase2.length ? unexpectedPhase2.map((x) => `- ${x.name}: got ${x.status}, expected one of ${x.expect.join(", ")}`).join("\n") : "- None in Phase 2 expected-status checks."}

${leakageFailures.length ? leakageFailures.map((x) => `- Probe ${x.id}: potential leakage in body preview.`).join("\n") : "- No obvious stack/schema/version leakage detected in sampled error payloads."}
`;

const reportPath = path.join(process.cwd(), "BLACK_BOX_CONTRACT_REPORT.md");
fs.writeFileSync(reportPath, md);
console.log(md);
