import { Router } from "express";
import { db, apiKeysTable, orgMembersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, getUserOrgIds, requireOrgRole } from "../lib/rbac";
import { generateApiKey, hashApiKey } from "../lib/crypto";
import { logger } from "../lib/logger";

const router = Router();

// ─── List API keys for an org ─────────────────────────────────────────────────
router.get("/api-keys", requireAuth, async (req, res) => {
  try {
    const { orgId } = req.query as { orgId?: string };
    const allowedOrgIds = getUserOrgIds(req);
    if (allowedOrgIds.length === 0) { res.json([]); return; }

    const keys = orgId && allowedOrgIds.includes(orgId)
      ? await db.query.apiKeysTable.findMany({ where: eq(apiKeysTable.orgId, orgId) })
      : await db.query.apiKeysTable.findMany();

    // Never return the hash — only prefix and metadata
    res.json(keys.map(({ keyHash: _, ...k }) => k));
  } catch (err) {
    req.log.error({ err }, "Failed to list API keys");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Create API key ───────────────────────────────────────────────────────────
router.post("/api-keys", requireAuth, async (req, res) => {
  try {
    const { orgId, name, expiresAt } = req.body as {
      orgId: string;
      name: string;
      expiresAt?: string;
    };

    const allowedOrgIds = getUserOrgIds(req);
    if (!allowedOrgIds.includes(orgId)) {
      res.status(403).json({ error: "Not a member of the specified organization" });
      return;
    }

    const { key, prefix, hash } = generateApiKey();

    await db.insert(apiKeysTable).values({
      id: crypto.randomUUID(),
      orgId,
      name,
      keyHash: hash,
      keyPrefix: prefix,
      isActive: true,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    logger.info({ orgId, prefix }, "API key created");

    // Return the full key ONCE — it cannot be retrieved again
    res.status(201).json({
      key,          // shown once only
      prefix,
      name,
      orgId,
      message: "Store this key securely — it will not be shown again.",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create API key");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Revoke API key ───────────────────────────────────────────────────────────
router.delete("/api-keys/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const apiKey = await db.query.apiKeysTable.findFirst({
      where: eq(apiKeysTable.id, id),
    });
    if (!apiKey) { res.status(404).json({ error: "Not found" }); return; }

    const allowedOrgIds = getUserOrgIds(req);
    if (!allowedOrgIds.includes(apiKey.orgId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    await db.delete(apiKeysTable).where(eq(apiKeysTable.id, id));
    logger.info({ id, prefix: apiKey.keyPrefix }, "API key revoked");
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to revoke API key");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Toggle active state ──────────────────────────────────────────────────────
router.patch("/api-keys/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const { isActive } = req.body as { isActive: boolean };
    const apiKey = await db.query.apiKeysTable.findFirst({
      where: eq(apiKeysTable.id, id),
    });
    if (!apiKey) { res.status(404).json({ error: "Not found" }); return; }

    const allowedOrgIds = getUserOrgIds(req);
    if (!allowedOrgIds.includes(apiKey.orgId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    await db.update(apiKeysTable).set({ isActive, updatedAt: new Date() }).where(eq(apiKeysTable.id, id));
    const updated = await db.query.apiKeysTable.findFirst({ where: eq(apiKeysTable.id, id) });
    const { keyHash: _, ...safe } = updated!;
    res.json(safe);
  } catch (err) {
    req.log.error({ err }, "Failed to update API key");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
