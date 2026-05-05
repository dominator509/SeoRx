import { Router } from "express";
import { db, aiProvidersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { getUserOrgIds, requireAuth } from "../lib/rbac";
import { encryptSecret } from "../lib/crypto";

const router = Router();

router.get("/ai-providers", requireAuth, async (req, res) => {
  try {
    const orgIds = getUserOrgIds(req);
    const providers = req.seorxUser?.role === "superadmin"
      ? await db.query.aiProvidersTable.findMany()
      : orgIds.length > 0
        ? await db.query.aiProvidersTable.findMany({ where: inArray(aiProvidersTable.orgId, orgIds) })
        : [];
    const safe = providers.map(({ encryptedApiKey: _, ...p }) => p);
    res.json(safe);
  } catch (err) {
    req.log.error({ err }, "Failed to list AI providers");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/ai-providers", requireAuth, async (req, res) => {
  try {
    const { orgId, name, provider, model, apiKey, baseUrl, isDefault = false } = req.body;
    const orgIds = getUserOrgIds(req);
    if (!orgId || (req.seorxUser?.role !== "superadmin" && !orgIds.includes(orgId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const id = crypto.randomUUID();
    const encryptedApiKey = apiKey ? encryptSecret(apiKey as string) : null;
    await db.insert(aiProvidersTable).values({ id, orgId, name, provider, model, encryptedApiKey, baseUrl, isDefault });
    const p = await db.query.aiProvidersTable.findFirst({ where: eq(aiProvidersTable.id, id) });
    if (!p) { res.status(500).json({ error: "Failed to create provider" }); return; }
    const { encryptedApiKey: _, ...safe } = p;
    res.status(201).json(safe);
  } catch (err) {
    req.log.error({ err }, "Failed to create AI provider");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/ai-providers/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const existing = await db.query.aiProvidersTable.findFirst({ where: eq(aiProvidersTable.id, id) });
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    const orgIds = getUserOrgIds(req);
    if (req.seorxUser?.role !== "superadmin" && !orgIds.includes(existing.orgId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const { name, model, apiKey, baseUrl, isActive, isDefault } = req.body;
    const updateData: Record<string, unknown> = { name, model, baseUrl, isActive, isDefault, updatedAt: new Date() };
    if (apiKey) updateData.encryptedApiKey = encryptSecret(apiKey as string);
    await db.update(aiProvidersTable).set(updateData).where(eq(aiProvidersTable.id, id));
    const p = await db.query.aiProvidersTable.findFirst({ where: eq(aiProvidersTable.id, id) });
    if (!p) { res.status(404).json({ error: "Not found" }); return; }
    const { encryptedApiKey: _, ...safe } = p;
    res.json(safe);
  } catch (err) {
    req.log.error({ err }, "Failed to update AI provider");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/ai-providers/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const existing = await db.query.aiProvidersTable.findFirst({ where: eq(aiProvidersTable.id, id) });
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    const orgIds = getUserOrgIds(req);
    if (req.seorxUser?.role !== "superadmin" && !orgIds.includes(existing.orgId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    await db.delete(aiProvidersTable).where(eq(aiProvidersTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete AI provider");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
