import {
  pgTable,
  text,
  timestamp,
  integer,
  real,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const auditStatusEnum = pgEnum("audit_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const issueSeverityEnum = pgEnum("issue_severity", [
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

export const issueCategoryEnum = pgEnum("issue_category", [
  "meta",
  "content",
  "performance",
  "links",
  "structured_data",
  "mobile",
  "security",
  "crawlability",
]);

export const issueStatusEnum = pgEnum("issue_status", [
  "open",
  "approved",
  "dismissed",
  "fixed",
]);

export const auditsTable = pgTable("audits", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  clientId: text("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  status: auditStatusEnum("status").notNull().default("pending"),
  seoScore: real("seo_score"),
  pageSpeedScore: real("page_speed_score"),
  crawledPages: integer("crawled_pages").default(0),
  scanDurationMs: integer("scan_duration_ms"),
  maxPages: integer("max_pages").default(100),
  includePageSpeed: boolean("include_page_speed").default(false),
  aiProviderId: text("ai_provider_id"),
  aiProviderUsed: text("ai_provider_used"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const auditIssuesTable = pgTable("audit_issues", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  auditId: text("audit_id")
    .notNull()
    .references(() => auditsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  category: issueCategoryEnum("category").notNull(),
  severity: issueSeverityEnum("severity").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  recommendation: text("recommendation"),
  aiRecommendation: text("ai_recommendation"),
  priorityScore: real("priority_score").notNull().default(0),
  status: issueStatusEnum("status").notNull().default("open"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  affectedElement: text("affected_element"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAuditSchema = createInsertSchema(auditsTable).omit({
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  seoScore: true,
  pageSpeedScore: true,
  crawledPages: true,
  scanDurationMs: true,
});

export const insertAuditIssueSchema = createInsertSchema(auditIssuesTable).omit({
  createdAt: true,
  approvedAt: true,
});

export type InsertAudit = z.infer<typeof insertAuditSchema>;
export type Audit = typeof auditsTable.$inferSelect;
export type InsertAuditIssue = z.infer<typeof insertAuditIssueSchema>;
export type AuditIssue = typeof auditIssuesTable.$inferSelect;
