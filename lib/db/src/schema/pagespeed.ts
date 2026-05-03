import { pgTable, text, timestamp, real, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { auditsTable } from "./audits";

export const deviceTypeEnum = pgEnum("device_type", ["mobile", "desktop"]);

export const pageSpeedResultsTable = pgTable("page_speed_results", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  auditId: text("audit_id")
    .notNull()
    .references(() => auditsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  device: deviceTypeEnum("device").notNull().default("mobile"),
  performanceScore: real("performance_score").notNull(),
  accessibilityScore: real("accessibility_score"),
  bestPracticesScore: real("best_practices_score"),
  seoScore: real("seo_score"),
  fcp: real("fcp"),
  lcp: real("lcp"),
  cls: real("cls"),
  fid: integer("fid"),
  tbt: real("tbt"),
  ttfb: real("ttfb"),
  speedIndex: real("speed_index"),
  totalBlockingTime: integer("total_blocking_time"),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
});

export const insertPageSpeedResultSchema = createInsertSchema(pageSpeedResultsTable).omit({
  fetchedAt: true,
});
export type InsertPageSpeedResult = z.infer<typeof insertPageSpeedResultSchema>;
export type PageSpeedResult = typeof pageSpeedResultsTable.$inferSelect;
