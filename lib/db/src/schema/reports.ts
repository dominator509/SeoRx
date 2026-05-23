import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { auditsTable } from "./audits";
import { clientsTable } from "./clients";

export const reportFormatEnum = pgEnum("report_format", ["pdf", "html", "json"]);
export const reportStatusEnum = pgEnum("report_status", [
  "generating",
  "ready",
  "failed",
]);

export const reportsTable = pgTable("reports", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  auditId: text("audit_id")
    .notNull()
    .references(() => auditsTable.id, { onDelete: "cascade" }),
  clientId: text("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  format: reportFormatEnum("format").notNull().default("pdf"),
  status: reportStatusEnum("status").notNull().default("generating"),
  downloadUrl: text("download_url"),
  summary: text("summary"),
  includeAiSummary: boolean("include_ai_summary").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({
  createdAt: true,
  updatedAt: true,
  downloadUrl: true,
  summary: true,
});
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reportsTable.$inferSelect;
