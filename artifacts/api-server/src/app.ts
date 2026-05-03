import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { rateLimit } from "express-rate-limit";
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
  keyGenerator: (req) => (req as any).clerkUserId ?? req.ip ?? "anon",
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
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// ─── Load user context (RBAC) for every request ───────────────────────────────
app.use(loadUserContext);

// ─── Apply rate limits ─────────────────────────────────────────────────────────
app.use("/api", globalRateLimit);
app.use("/api/audits", auditRateLimit);
app.use("/api/billing/webhook", webhookRateLimit);

// ─── Routes ────────────────────────────────────────────────────────────────────
app.use("/api", router);

export default app;
