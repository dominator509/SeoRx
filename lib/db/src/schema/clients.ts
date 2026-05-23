import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientsTable = pgTable("clients", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  orgId: text("org_id"),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  industry: text("industry"),
  contactEmail: text("contact_email"),
  logoUrl: text("logo_url"),
  seoScore: real("seo_score"),
  lastAuditAt: timestamp("last_audit_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({
  createdAt: true,
  updatedAt: true,
  seoScore: true,
  lastAuditAt: true,
});
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
