import { Router } from "express";
import { db, aiProvidersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

function encryptKey(apiKey: string): string {
  // Simple base64 encoding as a placeholder — replace with AES encryption in production
  return Buffer.from(apiKey).toString("base64");
}

router.get("/ai-providers", requireAuth, async (req, res) => {
  try {
    const providers = await db.query.aiProvidersTable.findMany();
    // Never expose encrypted keys
    const safe = providers.map(({ encryptedApiKey, ...p }) => p);
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
    const encryptedApiKey = apiKey ? encryptKey(apiKey) : null;
    await db.insert(aiProvidersTable).values({ id, orgId, name, provider, model, encryptedApiKey, baseUrl, isDefault });
    const p = await db.query.aiProvidersTable.findFirst({ where: eq(aiProvidersTable.id, id) });
    const { encryptedApiKey: _, ...safe } = p!;
    res.status(201).json(safe);
  } catch (err) {
    req.log.error({ err }, "Failed to create AI provider");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/ai-providers/:id", requireAuth, async (req, res) => {
  try {
    const { name, model, apiKey, baseUrl, isActive, isDefault } = req.body;
    const updateData: Record<string, any> = { name, model, baseUrl, isActive, isDefault, updatedAt: new Date() };
    if (apiKey) updateData.encryptedApiKey = encryptKey(apiKey);
    await db.update(aiProvidersTable).set(updateData).where(eq(aiProvidersTable.id, req.params.id));
    const p = await db.query.aiProvidersTable.findFirst({ where: eq(aiProvidersTable.id, req.params.id) });
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
    await db.delete(aiProvidersTable).where(eq(aiProvidersTable.id, req.params.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete AI provider");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
