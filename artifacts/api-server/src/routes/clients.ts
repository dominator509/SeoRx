import { Router } from "express";
import { db, clientsTable, auditsTable, auditIssuesTable } from "@workspace/db";
import { eq, and, like, or, sql, inArray } from "drizzle-orm";
import { requireAuth, assertClientAccess } from "../lib/rbac";
import { enforceClientLimit } from "../lib/plan-enforcement";

const router = Router();

router.get("/clients", requireAuth, async (req, res) => {
  try {
    const { search } = req.query as { search?: string };

    const conditions: any[] = [];
    if (search) {
      conditions.push(
        or(
          like(clientsTable.name, `%${search}%`),
          like(clientsTable.domain, `%${search}%`),
        ),
      );
    }

    const clients = await db.select().from(clientsTable).where(and(...conditions));

    const enriched = await Promise.all(
      clients.map(async (client) => {
        const auditCount = await db.$count(auditsTable, eq(auditsTable.clientId, client.id));
        const issueCount = await db.$count(
          auditIssuesTable,
          sql`${auditIssuesTable.auditId} IN (SELECT id FROM audits WHERE client_id = ${client.id})`,
        );
        return { ...client, auditCount, issueCount };
      }),
    );
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Failed to list clients");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/clients", requireAuth, enforceClientLimit(), async (req, res) => {
  try {
    const { name, domain, industry, contactEmail, logoUrl } = req.body;
    const orgId = req.body.orgId ?? null;

    const id = crypto.randomUUID();
    await db.insert(clientsTable).values({ id, orgId, name, domain, industry, contactEmail, logoUrl });
    const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, id) });
    res.status(201).json({ ...client, auditCount: 0, issueCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to create client");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/clients/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const client = await assertClientAccess(req, id);
    if (!client) { res.status(404).json({ error: "Not found or access denied" }); return; }

    const auditCount = await db.$count(auditsTable, eq(auditsTable.clientId, client.id));
    const issueCount = await db.$count(
      auditIssuesTable,
      sql`${auditIssuesTable.auditId} IN (SELECT id FROM audits WHERE client_id = ${client.id})`,
    );
    res.json({ ...client, auditCount, issueCount });
  } catch (err) {
    req.log.error({ err }, "Failed to get client");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/clients/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const client = await assertClientAccess(req, id);
    if (!client) { res.status(403).json({ error: "Access denied" }); return; }

    const { name, domain, industry, contactEmail, logoUrl } = req.body;
    await db
      .update(clientsTable)
      .set({ name, domain, industry, contactEmail, logoUrl, updatedAt: new Date() })
      .where(eq(clientsTable.id, id));
    const updated = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, id) });
    const auditCount = await db.$count(auditsTable, eq(auditsTable.clientId, id));
    res.json({ ...updated, auditCount, issueCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to update client");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/clients/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const client = await assertClientAccess(req, id);
    if (!client) { res.status(403).json({ error: "Access denied" }); return; }
    await db.delete(clientsTable).where(eq(clientsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete client");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
