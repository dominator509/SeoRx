import { Router, type Request } from "express";
import { db, orgIntegrationsTable, orgWebhooksTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { requireAuth, getUserOrgIds } from "../lib/rbac";
import { logger } from "../lib/logger";
import { decryptSecret, encryptSecret } from "../lib/crypto";

const router = Router();
const GSC_PROVIDER = "google_search_console" as const;
const VALID_WEBHOOK_EVENTS = ["audit.completed", "issue.approved", "issue.dismissed", "report.ready"];

function canAccessOrg(req: Request, orgId: string): boolean {
  return req.seorxUser?.role === "superadmin" || getUserOrgIds(req).includes(orgId);
}

function apiBaseUrl(req: Request): string {
  return process.env.API_BASE_URL ?? `${req.protocol}://${req.get("host")}`;
}

async function getGscIntegration(orgId: string) {
  return db.query.orgIntegrationsTable.findFirst({
    where: and(
      eq(orgIntegrationsTable.orgId, orgId),
      eq(orgIntegrationsTable.provider, GSC_PROVIDER),
      eq(orgIntegrationsTable.isActive, true),
    ),
  });
}

async function refreshGscAccessToken(orgId: string, encryptedRefreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = decryptSecret(encryptedRefreshToken);
  if (!clientId || !clientSecret || !refreshToken) return null;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenRes.ok) {
    logger.warn({ orgId, status: tokenRes.status }, "GSC token refresh failed");
    return null;
  }

  const tokens = await tokenRes.json() as { access_token: string; expires_in?: number; scope?: string };
  await db.update(orgIntegrationsTable)
    .set({
      encryptedAccessToken: encryptSecret(tokens.access_token),
      tokenExpiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
      scopes: tokens.scope,
      updatedAt: new Date(),
    })
    .where(and(eq(orgIntegrationsTable.orgId, orgId), eq(orgIntegrationsTable.provider, GSC_PROVIDER)));

  return tokens.access_token;
}

async function getValidGscAccessToken(orgId: string): Promise<string | null> {
  const integration = await getGscIntegration(orgId);
  if (!integration?.encryptedAccessToken) return null;

  const expiresAt = integration.tokenExpiresAt?.getTime() ?? 0;
  if (expiresAt > Date.now() + 60_000) {
    return decryptSecret(integration.encryptedAccessToken);
  }

  if (integration.encryptedRefreshToken) {
    return refreshGscAccessToken(orgId, integration.encryptedRefreshToken);
  }

  return decryptSecret(integration.encryptedAccessToken);
}

router.get("/integrations/gsc/connect", requireAuth, async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    res.status(503).json({
      error: "Not configured",
      message: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google Search Console.",
    });
    return;
  }

  const { orgId, returnUrl = "/" } = req.query as { orgId?: string; returnUrl?: string };
  if (!orgId) {
    res.status(400).json({ error: "Missing orgId" });
    return;
  }
  if (!canAccessOrg(req, orgId)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const redirectUri = `${apiBaseUrl(req)}/api/integrations/gsc/callback`;
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

router.get("/integrations/gsc/callback", requireAuth, async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!code || !clientId || !clientSecret) {
    res.status(400).json({ error: "Missing OAuth code or credentials" });
    return;
  }

  try {
    const parsed = state ? JSON.parse(state) as { orgId?: string; returnUrl?: string } : {};
    if (!parsed.orgId) {
      res.status(400).json({ error: "Missing orgId in OAuth state" });
      return;
    }
    if (!canAccessOrg(req, parsed.orgId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const redirectUri = `${apiBaseUrl(req)}/api/integrations/gsc/callback`;
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
      expires_in?: number;
      scope?: string;
      token_type?: string;
    };

    const existing = await getGscIntegration(parsed.orgId);
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptSecret(tokens.refresh_token)
      : existing?.encryptedRefreshToken ?? null;

    const values = {
      encryptedAccessToken: encryptSecret(tokens.access_token),
      encryptedRefreshToken,
      tokenExpiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
      scopes: tokens.scope,
      metadata: { tokenType: tokens.token_type ?? "Bearer" },
      isActive: true,
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(orgIntegrationsTable)
        .set(values)
        .where(eq(orgIntegrationsTable.id, existing.id));
    } else {
      await db.insert(orgIntegrationsTable).values({
        id: crypto.randomUUID(),
        orgId: parsed.orgId,
        provider: GSC_PROVIDER,
        ...values,
      });
    }

    logger.info({ orgId: parsed.orgId }, "GSC OAuth tokens stored");
    res.redirect(`${parsed.returnUrl ?? "/"}?gsc=connected`);
  } catch (err) {
    logger.error({ err }, "GSC callback error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/integrations/gsc/properties", requireAuth, async (req, res) => {
  const { orgId } = req.query as { orgId?: string };
  if (!orgId) {
    res.status(400).json({ error: "Missing orgId" });
    return;
  }
  if (!canAccessOrg(req, orgId)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const accessToken = await getValidGscAccessToken(orgId);
  if (!accessToken) {
    res.json({
      available: false,
      message: "Connect Google Search Console before importing ranking data.",
      properties: [],
    });
    return;
  }

  const apiRes = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15000),
  });

  if (!apiRes.ok) {
    res.status(502).json({ error: "Google Search Console request failed", statusCode: apiRes.status });
    return;
  }

  const data = await apiRes.json() as { siteEntry?: Array<{ siteUrl: string; permissionLevel: string }> };
  res.json({ available: true, properties: data.siteEntry ?? [] });
});

router.post("/integrations/gsc/analytics", requireAuth, async (req, res) => {
  const { orgId, siteUrl, startDate, endDate, dimensions = ["query", "page"] } = req.body as {
    orgId?: string;
    siteUrl: string;
    startDate: string;
    endDate: string;
    dimensions?: string[];
  };

  if (!orgId) {
    res.status(400).json({ error: "Missing orgId" });
    return;
  }
  if (!canAccessOrg(req, orgId)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const accessToken = await getValidGscAccessToken(orgId);
  if (!accessToken) {
    res.json({
      available: false,
      message: "Google Search Console is not connected for this organization.",
      siteUrl,
      startDate,
      endDate,
      rows: [],
    });
    return;
  }

  const apiRes = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate, dimensions }),
      signal: AbortSignal.timeout(30000),
    },
  );

  if (!apiRes.ok) {
    res.status(502).json({ error: "Google Search Console analytics request failed", statusCode: apiRes.status });
    return;
  }

  const data = await apiRes.json() as {
    rows?: Array<{ keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }>;
  };
  res.json({ available: true, siteUrl, startDate, endDate, rows: data.rows ?? [] });
});

router.get("/integrations/webhooks", requireAuth, async (req, res) => {
  const { orgId } = req.query as { orgId?: string };
  const allowedOrgIds = getUserOrgIds(req);

  if (orgId && !canAccessOrg(req, orgId)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const webhooks = req.seorxUser?.role === "superadmin" && !orgId
    ? await db.query.orgWebhooksTable.findMany()
    : orgId
      ? await db.query.orgWebhooksTable.findMany({ where: eq(orgWebhooksTable.orgId, orgId) })
      : allowedOrgIds.length > 0
        ? await db.query.orgWebhooksTable.findMany({ where: inArray(orgWebhooksTable.orgId, allowedOrgIds) })
        : [];

  res.json(webhooks.map(({ encryptedSecret: _, ...safe }) => safe));
});

router.post("/integrations/webhooks", requireAuth, async (req, res) => {
  const { orgId, url, events, secret } = req.body as {
    orgId: string;
    url: string;
    events: string[];
    secret?: string;
  };

  if (!canAccessOrg(req, orgId)) {
    res.status(403).json({ error: "Not a member of the specified organization" });
    return;
  }

  const invalidEvents = events.filter((event) => !VALID_WEBHOOK_EVENTS.includes(event));
  if (invalidEvents.length > 0) {
    res.status(400).json({ error: `Invalid events: ${invalidEvents.join(", ")}. Valid events: ${VALID_WEBHOOK_EVENTS.join(", ")}` });
    return;
  }

  try {
    new URL(url);
  } catch {
    res.status(400).json({ error: "Invalid webhook URL" });
    return;
  }

  const id = crypto.randomUUID();
  await db.insert(orgWebhooksTable).values({
    id,
    orgId,
    url,
    events,
    encryptedSecret: secret ? encryptSecret(secret) : null,
    isActive: true,
  });

  const webhook = await db.query.orgWebhooksTable.findFirst({ where: eq(orgWebhooksTable.id, id) });
  if (!webhook) {
    res.status(500).json({ error: "Failed to create webhook" });
    return;
  }

  const { encryptedSecret: _, ...safe } = webhook;
  logger.info({ orgId, url, events }, "Webhook registered");
  res.status(201).json(safe);
});

router.delete("/integrations/webhooks/:id", requireAuth, async (req, res) => {
  const id = req.params.id as string;
  const webhook = await db.query.orgWebhooksTable.findFirst({ where: eq(orgWebhooksTable.id, id) });
  if (!webhook) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!canAccessOrg(req, webhook.orgId)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  await db.delete(orgWebhooksTable).where(eq(orgWebhooksTable.id, id));
  res.status(204).send();
});

router.post("/integrations/webhooks/test", requireAuth, async (req, res) => {
  const { url, webhookId } = req.body as { url?: string; webhookId?: string };

  let targetUrl = url;
  let webhookOrgId: string | undefined;
  if (webhookId) {
    const webhook = await db.query.orgWebhooksTable.findFirst({ where: eq(orgWebhooksTable.id, webhookId) });
    if (!webhook) {
      res.status(404).json({ error: "Webhook not found" });
      return;
    }
    if (!canAccessOrg(req, webhook.orgId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    targetUrl = webhook.url;
    webhookOrgId = webhook.orgId;
  }

  if (!targetUrl) {
    res.status(400).json({ error: "Missing webhook URL" });
    return;
  }

  try {
    new URL(targetUrl);
  } catch {
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
    const testRes = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-SEORx-Event": "audit.completed", "X-SEORx-Test": "true" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (webhookId) {
      await db.update(orgWebhooksTable)
        .set({
          lastStatusCode: testRes.status,
          lastDeliveredAt: new Date(),
          lastError: testRes.ok ? null : `Target returned ${testRes.status}`,
          updatedAt: new Date(),
        })
        .where(eq(orgWebhooksTable.id, webhookId));
    }

    res.json({
      success: testRes.ok,
      statusCode: testRes.status,
      orgId: webhookOrgId,
      message: testRes.ok ? "Webhook delivered successfully" : `Target returned ${testRes.status}`,
    });
  } catch (err) {
    if (webhookId) {
      await db.update(orgWebhooksTable)
        .set({ lastError: (err as Error).message, updatedAt: new Date() })
        .where(eq(orgWebhooksTable.id, webhookId));
    }
    res.json({ success: false, orgId: webhookOrgId, message: `Delivery failed: ${(err as Error).message}` });
  }
});

export default router;
