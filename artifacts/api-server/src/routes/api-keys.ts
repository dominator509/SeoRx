import { Router } from "express";
import { db, apiKeysTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { requireAuth, getUserOrgIds } from "../lib/rbac";
import { requireApiKeyAuth } from "../lib/api-key-auth";
import { generateApiKey } from "../lib/crypto";
import { logger } from "../lib/logger";

const router = Router();

router.get("/api-keys", requireAuth, async (req, res) => {
  try {
    const { orgId } = req.query as { orgId?: string };
    const isSuperadmin = req.seorxUser?.role === "superadmin";
    const allowedOrgIds = getUserOrgIds(req);
    if (!isSuperadmin && allowedOrgIds.length === 0) {
      res.json([]);
      return;
    }
    if (orgId && !isSuperadmin && !allowedOrgIds.includes(orgId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const scopedOrgIds = orgId
      ? [orgId]
      : isSuperadmin
        ? []
        : allowedOrgIds;
    const keys = orgId
      ? await db.query.apiKeysTable.findMany({ where: eq(apiKeysTable.orgId, orgId) })
      : isSuperadmin
        ? await db.query.apiKeysTable.findMany()
        : scopedOrgIds.length === 1
          ? await db.query.apiKeysTable.findMany({ where: eq(apiKeysTable.orgId, scopedOrgIds[0]) })
          : await db.query.apiKeysTable.findMany({
              where: or(...scopedOrgIds.map((id) => eq(apiKeysTable.orgId, id))),
            });
    res.json(keys.map(({ keyHash: _, ...k }) => k));
  } catch (err) {
    req.log.error({ err }, "Failed to list API keys");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api-keys", requireAuth, async (req, res) => {
  try {
    const { orgId, name, expiresAt } = req.body as {
      orgId: string;
      name: string;
      expiresAt?: string;
    };
    const isSuperadmin = req.seorxUser?.role === "superadmin";
    const allowedOrgIds = getUserOrgIds(req);
    if (!isSuperadmin && !allowedOrgIds.includes(orgId)) {
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
    res.status(201).json({ key, prefix, name, orgId, message: "Store this key securely — it will not be shown again." });
  } catch (err) {
    req.log.error({ err }, "Failed to create API key");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api-keys/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const apiKey = await db.query.apiKeysTable.findFirst({ where: eq(apiKeysTable.id, id) });
    if (!apiKey) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const isSuperadmin = req.seorxUser?.role === "superadmin";
    const allowedOrgIds = getUserOrgIds(req);
    if (!isSuperadmin && !allowedOrgIds.includes(apiKey.orgId)) {
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

router.patch("/api-keys/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const { isActive } = req.body as { isActive: boolean };
    const apiKey = await db.query.apiKeysTable.findFirst({ where: eq(apiKeysTable.id, id) });
    if (!apiKey) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const isSuperadmin = req.seorxUser?.role === "superadmin";
    const allowedOrgIds = getUserOrgIds(req);
    if (!isSuperadmin && !allowedOrgIds.includes(apiKey.orgId)) {
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

router.get("/developer/authorize", requireApiKeyAuth, async (req, res) => {
  const apiKeyRecord = (req as any).apiKeyRecord;
  const org = (req as any).apiKeyOrg;
  res.json({
    ok: true,
    orgId: apiKeyRecord.orgId,
    orgName: org.name,
    keyPrefix: apiKeyRecord.keyPrefix,
    role: "developer",
  });
});

export default router;
