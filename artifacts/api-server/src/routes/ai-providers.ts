import { Router } from "express";
import { db, aiProvidersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/rbac";
import { encryptSecret, decryptSecret } from "../lib/crypto";

const router = Router();

router.get("/ai-providers", requireAuth, async (req, res) => {
  try {
    const providers = await db.query.aiProvidersTable.findMany();
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
    await db.delete(aiProvidersTable).where(eq(aiProvidersTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete AI provider");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
