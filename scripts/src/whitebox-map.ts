import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

type FnMetric = {
  file: string;
  name: string;
  line: number;
  complexity: number;
};

function resolveRepoRoot(): string {
  const cwd = process.cwd();
  const direct = path.resolve(cwd, "artifacts/api-server/src");
  if (fs.existsSync(direct)) return cwd;
  const parent = path.resolve(cwd, "..");
  const parentTarget = path.resolve(parent, "artifacts/api-server/src");
  if (fs.existsSync(parentTarget)) return parent;
  throw new Error(`Cannot locate repository root from ${cwd}`);
}

const repoRoot = resolveRepoRoot();
const root = path.resolve(repoRoot, "artifacts/api-server/src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && full.endsWith(".ts") && !full.includes("\\test\\")) out.push(full);
  }
  return out;
}

function decisionCount(node: ts.Node): number {
  let count = 0;
  function visit(n: ts.Node) {
    if (
      ts.isIfStatement(n)
      || ts.isForStatement(n)
      || ts.isForInStatement(n)
      || ts.isForOfStatement(n)
      || ts.isWhileStatement(n)
      || ts.isDoStatement(n)
      || ts.isCaseClause(n)
      || ts.isConditionalExpression(n)
      || ts.isCatchClause(n)
    ) {
      count += 1;
    }
    if (ts.isBinaryExpression(n)) {
      if (n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || n.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
        count += 1;
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(node);
  return count;
}

function getFnName(node: ts.Node, sf: ts.SourceFile): string {
  if (ts.isFunctionDeclaration(node)) return node.name?.text ?? "<anonymous-function>";
  if (ts.isMethodDeclaration(node)) return node.name.getText(sf);
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    const parent = node.parent;
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
    return "<anonymous-lambda>";
  }
  return "<unknown>";
}

const metrics: FnMetric[] = [];
for (const file of walk(root)) {
  const source = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  function visit(node: ts.Node) {
    if (
      ts.isFunctionDeclaration(node)
      || ts.isMethodDeclaration(node)
      || ts.isArrowFunction(node)
      || ts.isFunctionExpression(node)
    ) {
      const complexity = 1 + decisionCount(node);
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      metrics.push({
        file: path.relative(repoRoot, file).replaceAll("\\", "/"),
        name: getFnName(node, sf),
        line: line + 1,
        complexity,
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

const top = metrics
  .sort((a, b) => b.complexity - a.complexity)
  .slice(0, 20);

const lines: string[] = [];
lines.push("# INTERNAL_STRUCTURE_MAP");
lines.push("");
lines.push("## Highest Cyclomatic Hotspots (AST-derived)");
for (const m of top) {
  lines.push(`- ${m.file}:${m.line} - ${m.name} (complexity=${m.complexity})`);
}
lines.push("");
lines.push("## White Box Priority Targets");
lines.push("1. `routes/audits.ts` (`runRealAudit`, list/filter branches, error transitions)");
lines.push("2. `routes/integrations.ts` (input validation, OAuth/token branches, webhook state handling)");
lines.push("3. `lib/ai-adapter.ts` (provider switch, fallback/default, try/catch and batch mutation)");
lines.push("4. `lib/pagespeed.ts` (API fallback/synthetic data and parse branches)");
lines.push("5. `lib/crypto.ts` (legacy payload formats, malformed decoding, key-path branches)");

const outPath = path.resolve(repoRoot, "INTERNAL_STRUCTURE_MAP.md");
fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
console.log(lines.join("\n"));
