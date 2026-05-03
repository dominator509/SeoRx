import { Router } from "express";
import { db, clientsTable, auditsTable, auditIssuesTable } from "@workspace/db";
import { eq, and, like, or, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/clients", requireAuth, async (req, res) => {
  try {
    const { orgId, search } = req.query as { orgId?: string; search?: string };
    const conditions = [];
    if (orgId) conditions.push(eq(clientsTable.orgId, orgId));
    if (search) {
      conditions.push(
        or(
          like(clientsTable.name, `%${search}%`),
          like(clientsTable.domain, `%${search}%`),
        ),
      );
    }
    const clients = conditions.length
      ? await db.select().from(clientsTable).where(and(...conditions))
      : await db.select().from(clientsTable);

    const enriched = await Promise.all(
      clients.map(async (client) => {
        const auditCount = await db.$count(auditsTable, eq(auditsTable.clientId, client.id));
        const issueCount = await db.$count(auditIssuesTable, sql`${auditIssuesTable.auditId} IN (SELECT id FROM audits WHERE client_id = ${client.id})`);
        return { ...client, auditCount, issueCount };
      }),
    );
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Failed to list clients");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/clients", requireAuth, async (req, res) => {
  try {
    const { orgId, name, domain, industry, contactEmail, logoUrl } = req.body;
    const id = crypto.randomUUID();
    await db.insert(clientsTable).values({ id, orgId, name, domain, industry, contactEmail, logoUrl });
    const client = await db.query.clientsTable.findFirst({
      where: eq(clientsTable.id, id),
    });
    res.status(201).json({ ...client, auditCount: 0, issueCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to create client");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/clients/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const client = await db.query.clientsTable.findFirst({
      where: eq(clientsTable.id, id),
    });
    if (!client) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const auditCount = await db.$count(auditsTable, eq(auditsTable.clientId, client.id));
    const issueCount = await db.$count(auditIssuesTable, sql`${auditIssuesTable.auditId} IN (SELECT id FROM audits WHERE client_id = ${client.id})`);
    res.json({ ...client, auditCount, issueCount });
  } catch (err) {
    req.log.error({ err }, "Failed to get client");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/clients/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const { name, domain, industry, contactEmail, logoUrl } = req.body;
    await db.update(clientsTable).set({ name, domain, industry, contactEmail, logoUrl, updatedAt: new Date() }).where(eq(clientsTable.id, id));
    const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, id) });
    if (!client) { res.status(404).json({ error: "Not found" }); return; }
    const auditCount = await db.$count(auditsTable, eq(auditsTable.clientId, client.id));
    res.json({ ...client, auditCount, issueCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to update client");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/clients/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    await db.delete(clientsTable).where(eq(clientsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete client");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
