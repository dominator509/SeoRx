import Stripe from "stripe";
import { logger } from "./logger";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!STRIPE_SECRET_KEY) {
    logger.warn("STRIPE_SECRET_KEY not set — Stripe integration disabled");
    return null;
  }
  if (!_stripe) {
    _stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2026-04-22.dahlia" });
  }
  return _stripe;
}

// ─── Plan definitions ─────────────────────────────────────────────────────────

export const PLAN_LIMITS = {
  free: { auditsPerMonth: 3, clientsMax: 2, maxPages: 20, aiRecommendations: false },
  starter: { auditsPerMonth: 20, clientsMax: 10, maxPages: 50, aiRecommendations: true },
  professional: { auditsPerMonth: 100, clientsMax: 50, maxPages: 100, aiRecommendations: true },
  enterprise: { auditsPerMonth: Infinity, clientsMax: Infinity, maxPages: 200, aiRecommendations: true },
} as const;

export type PlanKey = keyof typeof PLAN_LIMITS;

// ─── Stripe price IDs (set in env or Stripe dashboard) ───────────────────────

export const PRICE_IDS = {
  starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "",
  professional_monthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY ?? "",
  enterprise_monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY ?? "",
};

// ─── Create checkout session ──────────────────────────────────────────────────

export async function createCheckoutSession(opts: {
  orgId: string;
  plan: PlanKey;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const priceMap: Record<string, string> = {
    starter: PRICE_IDS.starter_monthly,
    professional: PRICE_IDS.professional_monthly,
    enterprise: PRICE_IDS.enterprise_monthly,
  };

  const priceId = priceMap[opts.plan];
  if (!priceId) {
    logger.warn({ plan: opts.plan }, "No Stripe price ID configured for plan");
    return null;
  }

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: opts.customerEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata: { orgId: opts.orgId, plan: opts.plan },
    subscription_data: { metadata: { orgId: opts.orgId } },
  });
}

// ─── Create billing portal session ───────────────────────────────────────────

export async function createPortalSession(opts: {
  customerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  return stripe.billingPortal.sessions.create({
    customer: opts.customerId,
    return_url: opts.returnUrl,
  });
}

// ─── Handle webhook event ─────────────────────────────────────────────────────

export function constructWebhookEvent(payload: Buffer, sig: string, secret: string): Stripe.Event | null {
  const stripe = getStripe();
  if (!stripe) return null;
  try {
    return stripe.webhooks.constructEvent(payload, sig, secret);
  } catch (err) {
    logger.warn({ err }, "Stripe webhook signature verification failed");
    return null;
  }
}
