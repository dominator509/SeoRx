import { Router } from "express";
import { requireAuth, getUserOrgIds } from "../lib/rbac";
import { logger } from "../lib/logger";

const router = Router();

// ─── Google Search Console Integration ───────────────────────────────────────

/**
 * Initiate Google Search Console OAuth flow.
 * Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars.
 */
router.get("/integrations/gsc/connect", requireAuth, async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({
      error: "Not configured",
      message: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google Search Console.",
    });
    return;
  }

  const { orgId, returnUrl = "/" } = req.query as { orgId?: string; returnUrl?: string };
  const redirectUri = `${process.env.API_BASE_URL ?? ""}/api/integrations/gsc/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    access_type: "offline",
    prompt: "consent",
    state: JSON.stringify({ orgId, returnUrl }),
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

/**
 * Google Search Console OAuth callback — exchanges code for tokens.
 */
router.get("/integrations/gsc/callback", requireAuth, async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!code || !clientId || !clientSecret) {
    res.status(400).json({ error: "Missing OAuth code or credentials" });
    return;
  }

  try {
    const parsed = state ? JSON.parse(state as string) : {};
    const redirectUri = `${process.env.API_BASE_URL ?? ""}/api/integrations/gsc/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      logger.error({ status: tokenRes.status }, "GSC token exchange failed");
      res.status(502).json({ error: "Token exchange failed" });
      return;
    }

    const tokens = await tokenRes.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    // TODO: Store encrypted tokens in an org_integrations table (Phase 18 follow-up)
    logger.info({ orgId: parsed.orgId }, "GSC OAuth tokens received — storage pending");

    const returnUrl = parsed.returnUrl ?? "/";
    res.redirect(`${returnUrl}?gsc=connected`);
  } catch (err) {
    logger.error({ err }, "GSC callback error");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * List verified properties from Google Search Console for an org.
 * Requires stored GSC access token.
 */
router.get("/integrations/gsc/properties", requireAuth, async (req, res) => {
  // TODO: load stored token for orgId; for now return scaffold response
  res.json({
    available: false,
    message: "Connect Google Search Console via /api/integrations/gsc/connect to import ranking data.",
    properties: [],
  });
});

/**
 * Fetch GSC search analytics (impressions, clicks, CTR, position) for a domain.
 */
router.post("/integrations/gsc/analytics", requireAuth, async (req, res) => {
  const { siteUrl, startDate, endDate, dimensions = ["query", "page"] } = req.body as {
    siteUrl: string;
    startDate: string;
    endDate: string;
    dimensions?: string[];
  };

  // TODO: use stored access token
  res.json({
    available: false,
    message: "GSC token not yet connected. Use /api/integrations/gsc/connect first.",
    siteUrl,
    startDate,
    endDate,
    rows: [],
  });
});

// ─── Webhook Automation (Zapier / Make / n8n) ─────────────────────────────────

/**
 * List registered outbound webhook endpoints for an org.
 */
router.get("/integrations/webhooks", requireAuth, async (req, res) => {
  const { orgId } = req.query as { orgId?: string };
  const allowedOrgIds = getUserOrgIds(req);

  if (orgId && !allowedOrgIds.includes(orgId)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  // TODO: persist webhook registrations in DB; returning scaffold for now
  res.json([]);
});

/**
 * Register a new outbound webhook for audit events.
 * Events: audit.completed, issue.approved, report.ready
 */
router.post("/integrations/webhooks", requireAuth, async (req, res) => {
  const { orgId, url, events, secret } = req.body as {
    orgId: string;
    url: string;
    events: string[];
    secret?: string;
  };

  const allowedOrgIds = getUserOrgIds(req);
  if (!allowedOrgIds.includes(orgId)) {
    res.status(403).json({ error: "Not a member of the specified organization" });
    return;
  }

  const validEvents = ["audit.completed", "issue.approved", "issue.dismissed", "report.ready"];
  const invalidEvents = events.filter((e) => !validEvents.includes(e));
  if (invalidEvents.length > 0) {
    res.status(400).json({ error: `Invalid events: ${invalidEvents.join(", ")}. Valid events: ${validEvents.join(", ")}` });
    return;
  }

  // Validate URL
  try { new URL(url); } catch {
    res.status(400).json({ error: "Invalid webhook URL" });
    return;
  }

  // TODO: persist to DB (org_webhooks table — Phase 18 follow-up)
  const webhook = {
    id: crypto.randomUUID(),
    orgId,
    url,
    events,
    isActive: true,
    createdAt: new Date().toISOString(),
    message: "Webhook registered. DB persistence coming in next phase.",
  };

  logger.info({ orgId, url, events }, "Webhook registered (in-memory scaffold)");
  res.status(201).json(webhook);
});

/**
 * Test a webhook by sending a sample payload to the target URL.
 */
router.post("/integrations/webhooks/test", requireAuth, async (req, res) => {
  const { url } = req.body as { url: string };
  try { new URL(url); } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  const payload = {
    event: "audit.completed",
    timestamp: new Date().toISOString(),
    data: {
      auditId: "test-audit-id",
      clientName: "Test Client",
      url: "https://example.com",
      seoScore: 72,
      issueCount: 14,
    },
  };

  try {
    const testRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-SEORx-Event": "audit.completed", "X-SEORx-Test": "true" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    res.json({
      success: testRes.ok,
      statusCode: testRes.status,
      message: testRes.ok ? "Webhook delivered successfully" : `Target returned ${testRes.status}`,
    });
  } catch (err) {
    res.json({ success: false, message: `Delivery failed: ${(err as Error).message}` });
  }
});

export default router;
