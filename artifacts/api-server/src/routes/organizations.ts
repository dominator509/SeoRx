import { Router } from "express";
import { db, organizationsTable, orgMembersTable, clientsTable, auditsTable } from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";
import { requireAuth, getMembershipForOrg, getUserOrgIds, requireOrgRole } from "../lib/rbac";

const router = Router();
const VALID_MEMBER_ROLES = ["admin", "agency", "client", "viewer"] as const;
const VALID_MEMBER_ROLE_SET = new Set<string>(VALID_MEMBER_ROLES);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

router.get("/organizations", requireAuth, async (req, res) => {
  try {
    const orgIds = getUserOrgIds(req);
    if (req.seorxUser?.role !== "superadmin" && orgIds.length === 0) {
      res.json([]);
      return;
    }
    const orgs = req.seorxUser?.role === "superadmin"
      ? await db.query.organizationsTable.findMany()
      : await db.query.organizationsTable.findMany({ where: inArray(organizationsTable.id, orgIds) });
    const enriched = await Promise.all(
      orgs.map(async (org) => {
        const membership = getMembershipForOrg(req, org.id);
        const [memberCount, clientCount] = await Promise.all([
          db.$count(orgMembersTable, eq(orgMembersTable.orgId, org.id)),
          db.$count(clientsTable, eq(clientsTable.orgId, org.id)),
        ]);
        const auditCount = await db.$count(
          auditsTable,
          sql`${auditsTable.clientId} IN (SELECT id FROM clients WHERE org_id = ${org.id})`,
        );
        return { ...org, memberCount, clientCount, auditCount, myRole: membership?.role ?? (req.seorxUser?.role === "superadmin" ? "admin" : undefined) };
      }),
    );
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Failed to list organizations");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/organizations", requireAuth, async (req, res) => {
  const clerkId = (req as any).clerkUserId as string;
  try {
    const { name, slug, logoUrl } = req.body;
    if (!isNonEmptyString(name) || !isNonEmptyString(slug)) {
      res.status(400).json({ error: "Invalid name or slug" });
      return;
    }
    if (logoUrl !== undefined && logoUrl !== null) {
      try {
        new URL(String(logoUrl));
      } catch {
        res.status(400).json({ error: "Invalid logoUrl" });
        return;
      }
    }
    const id = crypto.randomUUID();
    await db.insert(organizationsTable).values({ id, name, slug, logoUrl });
    const memberId = crypto.randomUUID();
    await db.insert(orgMembersTable).values({
      id: memberId,
      orgId: id,
      userId: clerkId,
      email: req.seorxUser?.email ?? "",
      role: "admin",
    });
    const org = await db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.id, id),
    });
    res.status(201).json({ ...org, memberCount: 1, clientCount: 0, auditCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to create organization");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/organizations/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const membership = getMembershipForOrg(req, id);
    if (!membership && req.seorxUser?.role !== "superadmin") {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const org = await db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.id, id),
    });
    if (!org) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [memberCount, clientCount] = await Promise.all([
      db.$count(orgMembersTable, eq(orgMembersTable.orgId, org.id)),
      db.$count(clientsTable, eq(clientsTable.orgId, org.id)),
    ]);
    const auditCount = await db.$count(
      auditsTable,
      sql`${auditsTable.clientId} IN (SELECT id FROM clients WHERE org_id = ${org.id})`,
    );
    res.json({ ...org, memberCount, clientCount, auditCount, myRole: membership?.role ?? "admin" });
  } catch (err) {
    req.log.error({ err }, "Failed to get organization");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/organizations/:id", requireAuth, requireOrgRole("admin", "id"), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { name, logoUrl, plan } = req.body;
    if (name !== undefined && !isNonEmptyString(name)) {
      res.status(400).json({ error: "Invalid name" });
      return;
    }
    if (logoUrl !== undefined && logoUrl !== null) {
      try {
        new URL(String(logoUrl));
      } catch {
        res.status(400).json({ error: "Invalid logoUrl" });
        return;
      }
    }
    await db.update(organizationsTable).set({ name, logoUrl, plan, updatedAt: new Date() }).where(eq(organizationsTable.id, id));
    const org = await db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.id, id),
    });
    if (!org) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [memberCount, clientCount] = await Promise.all([
      db.$count(orgMembersTable, eq(orgMembersTable.orgId, org.id)),
      db.$count(clientsTable, eq(clientsTable.orgId, org.id)),
    ]);
    const auditCount = await db.$count(
      auditsTable,
      sql`${auditsTable.clientId} IN (SELECT id FROM clients WHERE org_id = ${org.id})`,
    );
    res.json({ ...org, memberCount, clientCount, auditCount });
  } catch (err) {
    req.log.error({ err }, "Failed to update organization");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/organizations/:id", requireAuth, requireOrgRole("admin", "id"), async (req, res) => {
  try {
    const id = req.params.id as string;
    await db.delete(organizationsTable).where(eq(organizationsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete organization");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/organizations/:orgId/members", requireAuth, async (req, res) => {
  try {
    const orgId = req.params.orgId as string;
    if (!getMembershipForOrg(req, orgId) && req.seorxUser?.role !== "superadmin") {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const members = await db.query.orgMembersTable.findMany({
      where: eq(orgMembersTable.orgId, orgId),
    });
    res.json(members);
  } catch (err) {
    req.log.error({ err }, "Failed to list members");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/organizations/:orgId/members", requireAuth, requireOrgRole("admin", "orgId"), async (req, res) => {
  try {
    const orgId = req.params.orgId as string;
    const { email, role } = req.body;
    if (!isNonEmptyString(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }
    if (!isNonEmptyString(role) || !VALID_MEMBER_ROLE_SET.has(role)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    const safeRole = role as (typeof VALID_MEMBER_ROLES)[number];
    const id = crypto.randomUUID();
    await db.insert(orgMembersTable).values({
      id,
      orgId,
      userId: id,
      email,
      role: safeRole,
    });
    const member = await db.query.orgMembersTable.findFirst({
      where: eq(orgMembersTable.id, id),
    });
    res.status(201).json(member);
  } catch (err) {
    req.log.error({ err }, "Failed to invite member");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
