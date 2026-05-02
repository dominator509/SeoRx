import { pgTable, text, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { auditsTable } from "./audits";

export const pageSpeedResultsTable = pgTable("page_speed_results", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  auditId: text("audit_id")
    .notNull()
    .references(() => auditsTable.id, { onDelete: "cascade" })
    .unique(),
  url: text("url").notNull(),
  performanceScore: real("performance_score").notNull(),
  accessibilityScore: real("accessibility_score").notNull(),
  bestPracticesScore: real("best_practices_score").notNull(),
  seoScore: real("seo_score").notNull(),
  fcp: real("fcp"),
  lcp: real("lcp"),
  cls: real("cls"),
  tbt: real("tbt"),
  ttfb: real("ttfb"),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
});

export const insertPageSpeedResultSchema = createInsertSchema(pageSpeedResultsTable).omit({
  fetchedAt: true,
});
export type InsertPageSpeedResult = z.infer<typeof insertPageSpeedResultSchema>;
export type PageSpeedResult = typeof pageSpeedResultsTable.$inferSelect;
