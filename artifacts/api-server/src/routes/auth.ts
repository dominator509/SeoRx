import { Router } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getOrCreateUser } from "../lib/auth";

const router = Router();

router.get("/auth/me", requireAuth, async (req, res) => {
  const clerkId = (req as any).clerkUserId as string;
  try {
    const clerkUser = await clerkClient.users.getUser(clerkId);
    const user = await getOrCreateUser(
      clerkId,
      clerkUser.emailAddresses[0]?.emailAddress ?? "",
      clerkUser.firstName ?? undefined,
      clerkUser.lastName ?? undefined,
    );
    res.json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to get user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/auth/me", requireAuth, async (req, res) => {
  const clerkId = (req as any).clerkUserId as string;
  try {
    const { firstName, lastName, avatarUrl } = req.body;
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, clerkId),
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    await db
      .update(usersTable)
      .set({ firstName, lastName, avatarUrl, updatedAt: new Date() })
      .where(eq(usersTable.clerkId, clerkId));
    const updated = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, clerkId),
    });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update user");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
