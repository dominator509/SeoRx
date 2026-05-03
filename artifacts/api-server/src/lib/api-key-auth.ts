import type { Request, Response, NextFunction } from "express";
import { db, apiKeysTable, organizationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function requireApiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "Missing API key" });
    return;
  }

  const apiKey = header.slice(7).trim();
  if (!apiKey.startsWith("srx_")) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid API key format" });
    return;
  }

  const keyHash = hashApiKey(apiKey);
  const record = await db.query.apiKeysTable.findFirst({
    where: eq(apiKeysTable.keyHash, keyHash),
  });

  if (!record || !record.isActive) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or inactive API key" });
    return;
  }

  const org = await db.query.organizationsTable.findFirst({
    where: eq(organizationsTable.id, record.orgId),
  });

  if (!org) {
    res.status(401).json({ error: "Unauthorized", message: "API key organization not found" });
    return;
  }

  await db.update(apiKeysTable).set({ lastUsedAt: new Date() }).where(eq(apiKeysTable.id, record.id));

  (req as any).apiKeyRecord = record;
  (req as any).apiKeyOrg = org;
  next();
}
