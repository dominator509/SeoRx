import { Router } from "express";
import { db, organizationsTable, orgMembersTable, clientsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, getMembershipForOrg, getUserOrgIds } from "../lib/rbac";

const router = Router();

router.get("/organizations", requireAuth, async (req, res) => {
  try {
    // Use preloaded org memberships from RBAC context
    const orgIds = getUserOrgIds(req);
    if (orgIds.length === 0) { res.json([]); return; }

    const orgs = await db.query.organizationsTable.findMany({
      where: sql`${organizationsTable.id} = ANY(ARRAY[${sql.join(orgIds.map((id) => sql`${id}`), sql`, `)}]::text[])`,
    });
    const enriched = await Promise.all(
      orgs.map(async (org) => {
        const membership = getMembershipForOrg(req, org.id);
        const [memberCount, clientCount] = await Promise.all([
          db.$count(orgMembersTable, eq(orgMembersTable.orgId, org.id)),
          db.$count(clientsTable, eq(clientsTable.orgId, org.id)),
        ]);
        return { ...org, memberCount, clientCount, auditCount: 0, myRole: membership?.role };
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
  const userEmail = req.seorxUser?.email ?? "";
  try {
    const { name, slug, logoUrl } = req.body;
    const id = crypto.randomUUID();
    await db.insert(organizationsTable).values({ id, name, slug, logoUrl });
    const memberId = crypto.randomUUID();
    await db.insert(orgMembersTable).values({
      id: memberId,
      orgId: id,
      userId: clerkId,
      email: "",
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
    res.json({ ...org, memberCount, clientCount, auditCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to get organization");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/organizations/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const { name, logoUrl, plan } = req.body;
    await db
      .update(organizationsTable)
      .set({ name, logoUrl, plan, updatedAt: new Date() })
      .where(eq(organizationsTable.id, id));
    const org = await db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.id, id),
    });
    if (!org) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ...org, memberCount: 0, clientCount: 0, auditCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to update organization");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/organizations/:id", requireAuth, async (req, res) => {
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
    const members = await db.query.orgMembersTable.findMany({
      where: eq(orgMembersTable.orgId, orgId),
    });
    res.json(members);
  } catch (err) {
    req.log.error({ err }, "Failed to list members");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/organizations/:orgId/members", requireAuth, async (req, res) => {
  try {
    const orgId = req.params.orgId as string;
    const { email, role } = req.body;
    const id = crypto.randomUUID();
    await db.insert(orgMembersTable).values({
      id,
      orgId,
      userId: id,
      email,
      role,
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
