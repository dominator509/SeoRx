import { Router, type Request } from "express";
import { db, organizationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUserOrgIds, requireAuth } from "../lib/rbac";
import {
  createCheckoutSession,
  createPortalSession,
  constructWebhookEvent,
  PLAN_LIMITS,
  type PlanKey,
} from "../lib/stripe";
import { logger } from "../lib/logger";

const router = Router();

function canAccessOrg(req: Request, orgId: string): boolean {
  return req.seorxUser?.role === "superadmin" || getUserOrgIds(req).includes(orgId);
}

// ─── Plan info (public) ───────────────────────────────────────────────────────
router.get("/billing/plans", (_req, res) => {
  res.json(
    Object.entries(PLAN_LIMITS).map(([plan, limits]) => ({
      plan,
      ...limits,
      auditsPerMonth: limits.auditsPerMonth === Infinity ? null : limits.auditsPerMonth,
      clientsMax: limits.clientsMax === Infinity ? null : limits.clientsMax,
    })),
  );
});

// ─── Create checkout session ──────────────────────────────────────────────────
router.post("/billing/checkout", requireAuth, async (req, res) => {
  try {
    const { orgId, plan, successUrl, cancelUrl } = req.body as {
      orgId: string;
      plan: PlanKey;
      successUrl: string;
      cancelUrl: string;
    };

    if (!["starter", "professional", "enterprise"].includes(plan)) {
      res.status(400).json({ error: "Invalid plan" });
      return;
    }

    const org = await db.query.organizationsTable.findFirst({ where: eq(organizationsTable.id, orgId) });
    if (!org) { res.status(404).json({ error: "Organization not found" }); return; }
    if (!canAccessOrg(req, orgId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const email = req.seorxUser?.email ?? "";
    const session = await createCheckoutSession({ orgId, plan, customerEmail: email, successUrl, cancelUrl });

    if (!session) {
      res.status(503).json({ error: "Stripe not configured", message: "Set STRIPE_SECRET_KEY to enable billing" });
      return;
    }

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    req.log.error({ err }, "Failed to create checkout session");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Customer portal ──────────────────────────────────────────────────────────
router.post("/billing/portal", requireAuth, async (req, res) => {
  try {
    const { orgId, returnUrl } = req.body as { orgId: string; returnUrl: string };

    const org = await db.query.organizationsTable.findFirst({ where: eq(organizationsTable.id, orgId) });
    if (!org) { res.status(404).json({ error: "Organization not found" }); return; }
    if (!canAccessOrg(req, orgId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const customerId = (org as any).stripeCustomerId as string | undefined;
    if (!customerId) {
      res.status(400).json({ error: "No Stripe customer linked to this organization" });
      return;
    }

    const session = await createPortalSession({ customerId, returnUrl });
    if (!session) {
      res.status(503).json({ error: "Stripe not configured" });
      return;
    }

    res.json({ url: session.url });
  } catch (err) {
    req.log.error({ err }, "Failed to create portal session");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Webhook handler ──────────────────────────────────────────────────────────
router.post("/billing/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"] as string;
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  if (!secret) {
    logger.warn("STRIPE_WEBHOOK_SECRET not set — webhook rejected");
    res.status(400).json({ error: "Webhook secret not configured" });
    return;
  }

  const event = constructWebhookEvent(req.body as Buffer, sig, secret);
  if (!event) {
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const { orgId, plan } = session.metadata ?? {};
        if (orgId && plan) {
          await db
            .update(organizationsTable)
            .set({ plan, updatedAt: new Date() } as any)
            .where(eq(organizationsTable.id, orgId));
          logger.info({ orgId, plan }, "Plan upgraded via Stripe checkout");
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as any;
        const orgId = sub.metadata?.orgId;
        if (orgId) {
          await db
            .update(organizationsTable)
            .set({ plan: "free", updatedAt: new Date() } as any)
            .where(eq(organizationsTable.id, orgId));
          logger.info({ orgId }, "Plan downgraded to free on subscription cancellation");
        }
        break;
      }
      default:
        logger.info({ type: event.type }, "Unhandled Stripe webhook event");
    }

    res.json({ received: true });
  } catch (err) {
    logger.error({ err, eventType: event.type }, "Webhook handler error");
    res.status(500).json({ error: "Webhook handler error" });
  }
});

export default router;
