import { Router } from "express";
import { db, organizationsTable, orgMembersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/organizations", requireAuth, async (req, res) => {
  const clerkId = (req as any).clerkUserId as string;
  try {
    const members = await db.query.orgMembersTable.findMany({
      where: eq(orgMembersTable.userId, clerkId),
    });
    const orgIds = members.map((m) => m.orgId);
    if (orgIds.length === 0) {
      res.json([]);
      return;
    }
    const orgs = await db.query.organizationsTable.findMany({
      where: sql`${organizationsTable.id} = ANY(${orgIds})`,
    });
    const enriched = await Promise.all(
      orgs.map(async (org) => {
        const [memberCount, clientCount] = await Promise.all([
          db.$count(orgMembersTable, eq(orgMembersTable.orgId, org.id)),
          db.$count(
            (await import("@workspace/db")).clientsTable,
            eq((await import("@workspace/db")).clientsTable.orgId, org.id),
          ),
        ]);
        return { ...org, memberCount, clientCount, auditCount: 0 };
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
    const org = await db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.id, req.params.id),
    });
    if (!org) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [memberCount, clientCount] = await Promise.all([
      db.$count(orgMembersTable, eq(orgMembersTable.orgId, org.id)),
      db.$count(
        (await import("@workspace/db")).clientsTable,
        eq((await import("@workspace/db")).clientsTable.orgId, org.id),
      ),
    ]);
    res.json({ ...org, memberCount, clientCount, auditCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to get organization");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/organizations/:id", requireAuth, async (req, res) => {
  try {
    const { name, logoUrl, plan } = req.body;
    await db
      .update(organizationsTable)
      .set({ name, logoUrl, plan, updatedAt: new Date() })
      .where(eq(organizationsTable.id, req.params.id));
    const org = await db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.id, req.params.id),
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
    await db.delete(organizationsTable).where(eq(organizationsTable.id, req.params.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete organization");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/organizations/:orgId/members", requireAuth, async (req, res) => {
  try {
    const members = await db.query.orgMembersTable.findMany({
      where: eq(orgMembersTable.orgId, req.params.orgId),
    });
    res.json(members);
  } catch (err) {
    req.log.error({ err }, "Failed to list members");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/organizations/:orgId/members", requireAuth, async (req, res) => {
  try {
    const { email, role } = req.body;
    const id = crypto.randomUUID();
    await db.insert(orgMembersTable).values({
      id,
      orgId: req.params.orgId,
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
