import { Router } from "express";
import { db, auditIssuesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.put("/issues/:id/approve", requireAuth, async (req, res) => {
  const clerkId = (req as any).clerkUserId as string;
  try {
    const id = req.params.id as string;
    await db.update(auditIssuesTable).set({
      status: "approved",
      approvedBy: clerkId,
      approvedAt: new Date(),
    }).where(eq(auditIssuesTable.id, id));
    const issue = await db.query.auditIssuesTable.findFirst({
      where: eq(auditIssuesTable.id, id),
    });
    if (!issue) { res.status(404).json({ error: "Not found" }); return; }
    res.json(issue);
  } catch (err) {
    req.log.error({ err }, "Failed to approve issue");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/issues/:id/dismiss", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    await db.update(auditIssuesTable).set({ status: "dismissed" }).where(eq(auditIssuesTable.id, id));
    const issue = await db.query.auditIssuesTable.findFirst({
      where: eq(auditIssuesTable.id, id),
    });
    if (!issue) { res.status(404).json({ error: "Not found" }); return; }
    res.json(issue);
  } catch (err) {
    req.log.error({ err }, "Failed to dismiss issue");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
