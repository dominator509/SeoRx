import type { Request, Response, NextFunction } from "express";
import { db, clientsTable, auditsTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { PLAN_LIMITS } from "./stripe";
import { logger } from "./logger";

/**
 * Middleware: enforce max clients plan limit before creating a new client.
 * With orgs removed, defaults to free plan limits.
 */
export function enforceClientLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limits = PLAN_LIMITS["free"];
      if (limits.clientsMax === Infinity) return next();

      const currentCount = await db.$count(clientsTable);
      if (currentCount >= limits.clientsMax) {
        res.status(402).json({
          error: "Plan limit reached",
          message: `Maximum of ${limits.clientsMax} clients reached. Upgrade to add more.`,
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
 * Middleware: enforce max audits per month.
 */
export function enforceAuditLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limits = PLAN_LIMITS["free"];
      if (limits.auditsPerMonth === Infinity) return next();

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthlyCount = await db.$count(
        auditsTable,
        and(gte(auditsTable.createdAt, monthStart)),
      );

      if (monthlyCount >= limits.auditsPerMonth) {
        res.status(402).json({
          error: "Plan limit reached",
          message: `Plan allows ${limits.auditsPerMonth} audits per month. You have used ${monthlyCount}.`,
          limit: limits.auditsPerMonth,
          current: monthlyCount,
          upgradeRequired: true,
        });
        return;
      }

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
 * Middleware: check whether AI recommendations are allowed.
 */
export function enforceAiLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body._aiAllowed = PLAN_LIMITS["free"].aiRecommendations;
      next();
    } catch {
      next();
    }
  };
}
