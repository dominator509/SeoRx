import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, pgEnum, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const integrationProviderEnum = pgEnum("integration_provider", [
  "google_search_console",
]);

export const orgIntegrationsTable = pgTable("org_integrations", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  orgId: text("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  provider: integrationProviderEnum("provider").notNull(),
  encryptedAccessToken: text("encrypted_access_token"),
  encryptedRefreshToken: text("encrypted_refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  scopes: text("scopes"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  isActive: boolean("is_active").notNull().default(true),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orgWebhooksTable = pgTable("org_webhooks", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  orgId: text("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  events: jsonb("events").$type<string[]>().notNull(),
  encryptedSecret: text("encrypted_secret"),
  isActive: boolean("is_active").notNull().default(true),
  lastStatusCode: integer("last_status_code"),
  lastDeliveredAt: timestamp("last_delivered_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrgIntegrationSchema = createInsertSchema(orgIntegrationsTable).omit({
  connectedAt: true,
  updatedAt: true,
});
export const insertOrgWebhookSchema = createInsertSchema(orgWebhooksTable).omit({
  createdAt: true,
  updatedAt: true,
  lastDeliveredAt: true,
  lastStatusCode: true,
  lastError: true,
});

export type InsertOrgIntegration = z.infer<typeof insertOrgIntegrationSchema>;
export type OrgIntegration = typeof orgIntegrationsTable.$inferSelect;
export type InsertOrgWebhook = z.infer<typeof insertOrgWebhookSchema>;
export type OrgWebhook = typeof orgWebhooksTable.$inferSelect;
