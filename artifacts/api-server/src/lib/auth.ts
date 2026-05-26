import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized", message: "Authentication required" });
    return;
  }
  (req as any).clerkUserId = userId;
  next();
}

export async function getOrCreateUser(clerkId: string, email: string, firstName?: string, lastName?: string) {
  let user = await db.query.usersTable.findFirst({
    where: eq(usersTable.clerkId, clerkId),
  });
  if (!user) {
    const id = crypto.randomUUID();
    await db
      .insert(usersTable)
      .values({
        id,
        clerkId,
        email,
        firstName,
        lastName,
        role: "admin",
      })
      .onConflictDoNothing({ target: usersTable.clerkId });
    user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, clerkId),
    });
  } else {
    const updates = {
      ...(!user.firstName && firstName ? { firstName } : {}),
      ...(!user.lastName && lastName ? { lastName } : {}),
      updatedAt: new Date(),
    };
    if (Object.keys(updates).length > 1) {
      await db.update(usersTable).set(updates).where(eq(usersTable.clerkId, clerkId));
      user = await db.query.usersTable.findFirst({
        where: eq(usersTable.clerkId, clerkId),
      });
    }
  }
  if (!user) {
    throw new Error(`Failed to materialize user for clerkId=${clerkId}`);
  }
  return user;
}
