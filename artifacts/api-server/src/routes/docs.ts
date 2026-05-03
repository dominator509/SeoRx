import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";

const router = Router();

function loadSpec() {
  const candidates = [
    resolve(process.cwd(), "lib/api-spec/openapi.yaml"),
    resolve(process.cwd(), "../lib/api-spec/openapi.yaml"),
    resolve(process.cwd(), "../../lib/api-spec/openapi.yaml"),
    resolve(__dirname, "../../../../lib/api-spec/openapi.yaml"),
  ];
  for (const p of candidates) {
    try {
      const raw = readFileSync(p, "utf8");
      return yaml.load(raw) as Record<string, unknown>;
    } catch {
    }
  }
  return { openapi: "3.1.0", info: { title: "SEORx API", version: "0.1.0" }, paths: {} };
}

const spec = loadSpec();

router.get("/openapi.json", (_req, res) => {
  res.json(spec);
});

router.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(spec, {
    customSiteTitle: "SEORx API Docs",
    customCss: `
      .swagger-ui .topbar { background: #111827; }
      .swagger-ui .topbar-wrapper .link span { display: none; }
      .swagger-ui .topbar-wrapper::after { content: "SEORx API"; color: #10b981; font-size: 1.2rem; font-weight: bold; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
  }),
);

export default router;
