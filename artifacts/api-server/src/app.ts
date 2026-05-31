import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { loadUserContext } from "./lib/rbac";
import { shouldEnableClerkAuth } from "./lib/clerk-config";

const app: Express = express();

// ─── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginEmbedderPolicy: false, // Clerk requires this off for iframes
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://clerk.accounts.dev", "https://*.clerk.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https://clerk.accounts.dev", "https://*.clerk.com", "wss:"],
        frameSrc: ["'self'", "https://*.clerk.com"],
        fontSrc: ["'self'", "https:", "data:"],
      },
    },
  }),
);

// ─── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      // Allow same-origin (no Origin header), explicitly allowed origins, and dev
      if (!origin || process.env.NODE_ENV !== "production" || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
  }),
);

// ─── Rate limiting ─────────────────────────────────────────────────────────────
const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", message: "Rate limit exceeded — try again in 15 minutes" },
  skip: (req) => req.path === "/api/healthz",
});

const auditRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many audits", message: "Audit rate limit exceeded — 20 per hour" },
  keyGenerator: (req) => (req as any).clerkUserId ?? ipKeyGenerator(req as any),
});

const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Logging ───────────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ─── Clerk proxy (must come before body parsing) ───────────────────────────────
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// ─── Body parsing ──────────────────────────────────────────────────────────────
// Raw body for Stripe webhook signature verification
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ─── Clerk auth middleware ─────────────────────────────────────────────────────
const clerkAuthEnabled = shouldEnableClerkAuth(process.env);

if (clerkAuthEnabled) {
  app.use(
    clerkMiddleware((req) => ({
      publishableKey: publishableKeyFromHost(
        getClerkProxyHost(req) ?? "",
        process.env.CLERK_PUBLISHABLE_KEY,
      ),
    })),
  );
} else {
  logger.warn(
    "Clerk auth middleware disabled: missing/invalid CLERK_PUBLISHABLE_KEY or CLERK_SECRET_KEY. Protected routes will return 401.",
  );
}

// ─── Load user context (RBAC) for every request ───────────────────────────────
app.use(loadUserContext);

// ─── Apply rate limits ─────────────────────────────────────────────────────────
app.use("/api", globalRateLimit);
app.use("/api/audits", auditRateLimit);
app.use("/api/billing/webhook", webhookRateLimit);

// ─── Routes ────────────────────────────────────────────────────────────────────
app.use("/api", router);

// ─── API error normalization ───────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled API error");

  // Malformed JSON/body payloads should return deterministic client errors.
  if (err?.type === "entity.parse.failed" || err instanceof SyntaxError) {
    res.status(400).json({ error: "Invalid JSON payload" });
    return;
  }

  // Normalize auth middleware misconfiguration issues away from generic 500 HTML.
  if (typeof err?.message === "string" && err.message.toLowerCase().includes("publishable key")) {
    res.status(503).json({ error: "Authentication service misconfigured" });
    return;
  }

  res.status(500).json({ error: "Internal server error" });
});

export default app;
