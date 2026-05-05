import type { Request, Response, NextFunction } from "express";
import { db, usersTable, orgMembersTable, clientsTable, auditsTable } from "@workspace/db";
import { eq, inArray, or } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import type { User, OrgMember } from "@workspace/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrgRole = "admin" | "agency" | "client" | "viewer";
export type GlobalRole = "superadmin" | "admin" | "agency" | "client" | "viewer";

declare global {
  namespace Express {
    interface Request {
      seorxUser?: User;
      orgMemberships?: OrgMember[];
      currentOrgId?: string;
      currentOrgRole?: OrgRole;
    }
  }
}

// Role hierarchy: higher index = more privileged
const ROLE_HIERARCHY: OrgRole[] = ["viewer", "client", "agency", "admin"];

function roleAtLeast(actual: OrgRole, required: OrgRole): boolean {
  return ROLE_HIERARCHY.indexOf(actual) >= ROLE_HIERARCHY.indexOf(required);
}

// ─── Core middleware: attach user + memberships to every authenticated request ─

export async function loadUserContext(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    // Not authenticated — skip (requireAuth will catch this separately)
    return next();
  }

  try {
    let user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, clerkId),
    });

    // Auto-provision user row on first login
    if (!user) {
      const email = (auth as any)?.sessionClaims?.email ?? "";
      const id = crypto.randomUUID();
      await db.insert(usersTable).values({
        id,
        clerkId,
        email,
        role: "admin",
      });
      user = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
    }

    if (!user) return next();

    req.seorxUser = user;
    (req as any).clerkUserId = clerkId;
    req.orgMemberships = await db.query.orgMembersTable.findMany({
      where: or(eq(orgMembersTable.userId, clerkId), eq(orgMembersTable.userId, user.id)),
    });

    next();
  } catch (err) {
    req.log?.error({ err }, "loadUserContext failed");
    next(); // non-fatal — routes will still auth-check
  }
}

// ─── requireAuth (upgraded — uses preloaded context) ──────────────────────────

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const clerkId = (req as any).clerkUserId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized", message: "Authentication required" });
    return;
  }
  next();
}

// ─── Org membership helpers ───────────────────────────────────────────────────

export function getMembershipForOrg(req: Request, orgId: string): OrgMember | undefined {
  return req.orgMemberships?.find((m) => m.orgId === orgId);
}

export function getUserOrgIds(req: Request): string[] {
  if (req.seorxUser?.role === "superadmin") return [];
  return [...new Set((req.orgMemberships ?? []).map((m) => m.orgId))];
}

// ─── Middleware: require org membership (any role) ────────────────────────────

export function requireOrgMember(orgIdParam = "orgId") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const orgId = (req.params[orgIdParam] ?? req.query[orgIdParam] ?? req.body?.[orgIdParam]) as string;
    if (!orgId) {
      res.status(400).json({ error: "Missing orgId" });
      return;
    }
    if (req.seorxUser?.role !== "superadmin" && !getMembershipForOrg(req, orgId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    req.currentOrgId = orgId;
    req.currentOrgRole = getMembershipForOrg(req, orgId)?.role;
    next();
  };
}

// ─── Middleware: require minimum role within the current org ──────────────────

export function requireOrgRole(minRole: OrgRole, orgIdParam = "orgId") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const orgId = (req.params[orgIdParam] ?? req.query[orgIdParam] ?? req.body?.[orgIdParam]) as string;
    if (!orgId) {
      res.status(400).json({ error: "Missing orgId" });
      return;
    }
    if (req.seorxUser?.role !== "superadmin") {
      const membership = getMembershipForOrg(req, orgId);
      if (!membership || !roleAtLeast(membership.role, minRole)) {
        res.status(403).json({ error: "Insufficient organization permissions" });
        return;
      }
      req.currentOrgRole = membership.role;
    } else {
      req.currentOrgRole = "admin";
    }
    req.currentOrgId = orgId;
    next();
  };
}

// ─── Data isolation helpers ───────────────────────────────────────────────────

/**
 * Returns the list of clientIds the current user is allowed to access,
 * scoped to their org memberships.
 */
export async function getAllowedClientIds(req: Request): Promise<string[]> {
  const orgIds = getUserOrgIds(req);
  const query = db.select({ id: clientsTable.id }).from(clientsTable);
  const clients = req.seorxUser?.role === "superadmin"
    ? await query
    : orgIds.length > 0
      ? await query.where(inArray(clientsTable.orgId, orgIds))
      : [];

  return clients.map((c) => c.id);
}

/**
 * Verify a client belongs to one of the user's orgs. Returns the client or null.
 */
export async function assertClientAccess(req: Request, clientId: string) {
  const client = await db.query.clientsTable.findFirst({
    where: eq(clientsTable.id, clientId),
  });
  if (!client) return null;
  if (req.seorxUser?.role === "superadmin") return client;
  const orgId = client.orgId;
  if (!orgId || !getMembershipForOrg(req, orgId)) return null;
  return client;
}

/**
 * Verify an audit's client belongs to one of the user's orgs.
 */
export async function assertAuditAccess(req: Request, auditId: string) {
  const audit = await db.query.auditsTable.findFirst({
    where: eq(auditsTable.id, auditId),
  });
  if (!audit) return null;

  const client = await assertClientAccess(req, audit.clientId);
  return client ? audit : null;
}
