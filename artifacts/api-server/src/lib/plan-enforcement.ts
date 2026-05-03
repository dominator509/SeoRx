import type { Request, Response, NextFunction } from "express";
import { db, clientsTable, auditsTable, organizationsTable } from "@workspace/db";
import { eq, and, gte, inArray } from "drizzle-orm";
import { getUserOrgIds } from "./rbac";
import { PLAN_LIMITS, type PlanKey } from "./stripe";
import { logger } from "./logger";

async function getOrgPlan(orgId: string): Promise<PlanKey> {
  const org = await db.query.organizationsTable.findFirst({
    where: eq(organizationsTable.id, orgId),
  });
  return (org?.plan ?? "free") as PlanKey;
}

/**
 * Middleware: enforce max clients per org plan before creating a new client.
 * Expects `orgId` in req.body.
 */
export function enforceClientLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.body?.orgId as string | undefined;
      if (!orgId) return next();

      const plan = await getOrgPlan(orgId);
      const limits = PLAN_LIMITS[plan];
      if (limits.clientsMax === Infinity) return next();

      const currentCount = await db.$count(clientsTable, eq(clientsTable.orgId, orgId));
      if (currentCount >= limits.clientsMax) {
        res.status(402).json({
          error: "Plan limit reached",
          message: `Your ${plan} plan allows a maximum of ${limits.clientsMax} client${limits.clientsMax !== 1 ? "s" : ""}. Upgrade to add more.`,
          limit: limits.clientsMax,
          current: currentCount,
          upgradeRequired: true,
        });
        return;
      }
      next();
    } catch (err) {
      logger.warn({ err }, "enforceClientLimit check failed — allowing request");
      next();
    }
  };
}

/**
 * Middleware: enforce max audits per month per org plan before creating a new audit.
 * Looks up the client's orgId from req.body.clientId, then checks the org plan.
 */
export function enforceAuditLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = req.body?.clientId as string | undefined;
      if (!clientId) return next();

      const client = await db.query.clientsTable.findFirst({
        where: eq(clientsTable.id, clientId),
      });
      if (!client) return next();

      const plan = await getOrgPlan(client.orgId);
      const limits = PLAN_LIMITS[plan];
      if (limits.auditsPerMonth === Infinity) return next();

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      // Count all audits this month for this org's clients
      const orgClients = await db
        .select({ id: clientsTable.id })
        .from(clientsTable)
        .where(eq(clientsTable.orgId, client.orgId));
      const orgClientIds = orgClients.map((c) => c.id);

      const monthlyCount = orgClientIds.length > 0
        ? await db.$count(
            auditsTable,
            and(
              inArray(auditsTable.clientId, orgClientIds),
              gte(auditsTable.createdAt, monthStart),
            ),
          )
        : 0;

      if (monthlyCount >= limits.auditsPerMonth) {
        res.status(402).json({
          error: "Plan limit reached",
          message: `Your ${plan} plan allows ${limits.auditsPerMonth} audit${limits.auditsPerMonth !== 1 ? "s" : ""} per month. You have used ${monthlyCount}. Upgrade or wait until next month.`,
          limit: limits.auditsPerMonth,
          current: monthlyCount,
          upgradeRequired: true,
        });
        return;
      }

      // Also enforce maxPages — clamp req.body.maxPages to plan max
      if (req.body?.maxPages && Number(req.body.maxPages) > limits.maxPages) {
        req.body.maxPages = limits.maxPages;
      }

      next();
    } catch (err) {
      logger.warn({ err }, "enforceAuditLimit check failed — allowing request");
      next();
    }
  };
}

/**
 * Middleware: check whether AI recommendations are allowed on the org's plan.
 * Sets req.body._aiAllowed = false if not, which the audit route reads.
 */
export function enforceAiLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = req.body?.clientId as string | undefined;
      if (!clientId) return next();

      const client = await db.query.clientsTable.findFirst({
        where: eq(clientsTable.id, clientId),
      });
      if (!client) return next();

      const plan = await getOrgPlan(client.orgId);
      req.body._aiAllowed = PLAN_LIMITS[plan].aiRecommendations;
      next();
    } catch {
      next();
    }
  };
}
