import { Router } from "express";
import { db, aiProvidersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { getUserOrgIds, requireAuth } from "../lib/rbac";
import { encryptSecret } from "../lib/crypto";

const router = Router();
const VALID_PROVIDER_TYPES = ["openai", "anthropic", "gemini", "ollama", "custom"] as const;
const VALID_PROVIDER_TYPE_SET = new Set<string>(VALID_PROVIDER_TYPES);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

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
    if (!isNonEmptyString(orgId) || !isNonEmptyString(name) || !isNonEmptyString(provider) || !isNonEmptyString(model)) {
      res.status(400).json({ error: "Invalid provider payload" });
      return;
    }
    if (!VALID_PROVIDER_TYPE_SET.has(provider)) {
      res.status(400).json({ error: "Invalid provider type" });
      return;
    }
    const safeProvider = provider as (typeof VALID_PROVIDER_TYPES)[number];
    if (baseUrl !== undefined && baseUrl !== null) {
      try {
        new URL(String(baseUrl));
      } catch {
        res.status(400).json({ error: "Invalid baseUrl" });
        return;
      }
    }
    const orgIds = getUserOrgIds(req);
    if (!orgId || (req.seorxUser?.role !== "superadmin" && !orgIds.includes(orgId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const id = crypto.randomUUID();
    const encryptedApiKey = apiKey ? encryptSecret(apiKey as string) : null;
    if (isDefault) {
      await db.update(aiProvidersTable).set({ isDefault: false }).where(eq(aiProvidersTable.orgId, orgId));
    }
    await db.insert(aiProvidersTable).values({
      id,
      orgId,
      name,
      provider: safeProvider,
      model,
      encryptedApiKey,
      baseUrl,
      isDefault,
    });
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
    if (name !== undefined && !isNonEmptyString(name)) {
      res.status(400).json({ error: "Invalid name" });
      return;
    }
    if (model !== undefined && !isNonEmptyString(model)) {
      res.status(400).json({ error: "Invalid model" });
      return;
    }
    if (baseUrl !== undefined && baseUrl !== null) {
      try {
        new URL(String(baseUrl));
      } catch {
        res.status(400).json({ error: "Invalid baseUrl" });
        return;
      }
    }
    if (isActive !== undefined && typeof isActive !== "boolean") {
      res.status(400).json({ error: "Invalid isActive flag" });
      return;
    }
    if (isDefault !== undefined && typeof isDefault !== "boolean") {
      res.status(400).json({ error: "Invalid isDefault flag" });
      return;
    }
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (model !== undefined) updateData.model = model;
    if (baseUrl !== undefined) updateData.baseUrl = baseUrl;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isDefault !== undefined) updateData.isDefault = isDefault;
    if (apiKey) updateData.encryptedApiKey = encryptSecret(apiKey as string);
    if (isDefault) {
      await db.update(aiProvidersTable).set({ isDefault: false }).where(eq(aiProvidersTable.orgId, existing.orgId));
    }
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
