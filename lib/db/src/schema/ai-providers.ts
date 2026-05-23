import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const aiProviderTypeEnum = pgEnum("ai_provider_type", [
  "openai",
  "anthropic",
  "gemini",
  "ollama",
  "custom",
]);

export const aiProvidersTable = pgTable("ai_providers", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  orgId: text("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  provider: aiProviderTypeEnum("provider").notNull(),
  model: text("model").notNull(),
  encryptedApiKey: text("encrypted_api_key"),
  baseUrl: text("base_url"),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAiProviderSchema = createInsertSchema(aiProvidersTable).omit({
  createdAt: true,
  updatedAt: true,
  encryptedApiKey: true,
});
export type InsertAiProvider = z.infer<typeof insertAiProviderSchema>;
export type AiProvider = typeof aiProvidersTable.$inferSelect;
