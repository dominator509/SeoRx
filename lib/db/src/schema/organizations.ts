import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orgPlanEnum = pgEnum("org_plan", [
  "free",
  "starter",
  "professional",
  "enterprise",
]);

export const orgMemberRoleEnum = pgEnum("org_member_role", [
  "admin",
  "agency",
  "client",
  "viewer",
]);

export const organizationsTable = pgTable("organizations", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  plan: orgPlanEnum("plan").notNull().default("free"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orgMembersTable = pgTable("org_members", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  orgId: text("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: orgMemberRoleEnum("role").notNull().default("viewer"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const insertOrganizationSchema = createInsertSchema(organizationsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertOrgMemberSchema = createInsertSchema(orgMembersTable).omit({
  joinedAt: true,
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizationsTable.$inferSelect;
export type InsertOrgMember = z.infer<typeof insertOrgMemberSchema>;
export type OrgMember = typeof orgMembersTable.$inferSelect;
