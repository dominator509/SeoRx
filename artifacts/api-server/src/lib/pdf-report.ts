import PDFDocument from "pdfkit";
import type { Readable } from "stream";
import type { AuditIssue, Audit } from "@workspace/db";
import type { GeoAeoReportPayload } from "./geo-aeo/report";

export interface ReportData {
  reportTitle: string;
  clientName: string;
  siteUrl: string;
  generatedAt: Date;
  audit: Audit;
  issues: AuditIssue[];
  summary?: string | null;
}

const COLORS = {
  primary: "#059669",       // emerald-600
  dark: "#111827",          // gray-900
  muted: "#6b7280",         // gray-500
  border: "#e5e7eb",        // gray-200
  critical: "#dc2626",      // red-600
  high: "#ea580c",          // orange-600
  medium: "#d97706",        // amber-600
  low: "#2563eb",           // blue-600
  info: "#6b7280",          // gray-500
  approved: "#059669",
  open: "#6b7280",
  dismissed: "#9ca3af",
};

function severityColor(severity: string): string {
  return (COLORS as any)[severity] ?? COLORS.muted;
}

function scoreColor(score: number): string {
  if (score >= 80) return COLORS.primary;
  if (score >= 60) return COLORS.medium;
  return COLORS.critical;
}

export function generatePdfReport(data: ReportData): Readable {
  const doc = new PDFDocument({
    margin: 50,
    size: "A4",
    bufferPages: true,
    info: { Title: data.reportTitle, Author: "SEORx" },
  });

  const pageWidth = doc.page.width - 100; // minus margins

  // ─── Cover header ──────────────────────────────────────────────────────────
  doc
    .rect(0, 0, doc.page.width, 160)
    .fill(COLORS.dark);

  doc
    .fillColor("#ffffff")
    .fontSize(28)
    .font("Helvetica-Bold")
    .text("SEORx", 50, 45);

  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor("#9ca3af")
    .text("AI-Powered SEO Audit Platform", 50, 80);

  doc
    .fontSize(18)
    .font("Helvetica-Bold")
    .fillColor("#ffffff")
    .text(data.reportTitle, 50, 110, { width: pageWidth });

  // ─── Meta row ─────────────────────────────────────────────────────────────
  doc.moveDown(4);
  const metaY = 180;

  doc
    .fillColor(COLORS.muted)
    .fontSize(9)
    .font("Helvetica")
    .text("Client", 50, metaY)
    .text("Site URL", 200, metaY)
    .text("Generated", 380, metaY)
    .text("Pages Crawled", 510, metaY);

  doc
    .fillColor(COLORS.dark)
    .fontSize(10)
    .font("Helvetica-Bold")
    .text(data.clientName, 50, metaY + 14)
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.primary)
    .text(data.siteUrl, 200, metaY + 14, { width: 160 })
    .fillColor(COLORS.dark)
    .fontSize(10)
    .font("Helvetica-Bold")
    .text(data.generatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), 380, metaY + 14)
    .text(String(data.audit.crawledPages ?? 0), 510, metaY + 14);

  // ─── Divider ──────────────────────────────────────────────────────────────
  doc
    .moveTo(50, metaY + 40)
    .lineTo(doc.page.width - 50, metaY + 40)
    .stroke(COLORS.border);

  // ─── Score cards ─────────────────────────────────────────────────────────
  const cardY = metaY + 55;
  const cardW = 115;
  const cardGap = 15;
  const cards = [
    { label: "SEO Score", value: data.audit.seoScore != null ? `${Math.round(data.audit.seoScore)}/100` : "N/A", color: scoreColor(data.audit.seoScore ?? 0) },
    { label: "Total Issues", value: String(data.issues.length), color: COLORS.dark },
    { label: "Critical", value: String(data.issues.filter((i) => i.severity === "critical").length), color: COLORS.critical },
    { label: "High", value: String(data.issues.filter((i) => i.severity === "high").length), color: COLORS.high },
  ];

  cards.forEach((card, i) => {
    const x = 50 + i * (cardW + cardGap);
    doc
      .roundedRect(x, cardY, cardW, 64, 6)
      .strokeColor(COLORS.border)
      .lineWidth(1)
      .stroke();

    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .fillColor(card.color)
      .text(card.value, x + 12, cardY + 12, { width: cardW - 24 });

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(COLORS.muted)
      .text(card.label, x + 12, cardY + 44);
  });

  // ─── Executive summary ────────────────────────────────────────────────────
  if (data.summary) {
    const sumY = cardY + 90;
    doc
      .fontSize(13)
      .font("Helvetica-Bold")
      .fillColor(COLORS.dark)
      .text("Executive Summary", 50, sumY);

    doc
      .moveDown(0.4)
      .fontSize(10)
      .font("Helvetica")
      .fillColor(COLORS.muted)
      .text(data.summary, 50, undefined, { width: pageWidth, lineGap: 4 });
  }

  // ─── Issues section ───────────────────────────────────────────────────────
  doc.addPage();

  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .fillColor(COLORS.dark)
    .text("Issue Details", 50, 50);

  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor(COLORS.muted)
    .text(`${data.issues.length} issue${data.issues.length !== 1 ? "s" : ""} found — sorted by priority score`, 50, 72);

  const sorted = [...data.issues].sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));

  let y = 95;

  for (const issue of sorted) {
    // Estimate height needed: title + description + recommendation + padding
    const descHeight = Math.min(doc.fontSize(9).heightOfString(issue.description, { width: pageWidth - 80 }), 80);
    const recHeight = Math.min(doc.fontSize(9).heightOfString(issue.recommendation ?? "", { width: pageWidth - 80 }), 60);
    const blockHeight = 24 + descHeight + recHeight + 30;

    if (y + blockHeight > doc.page.height - 70) {
      doc.addPage();
      y = 50;
    }

    // Severity badge
    const badgeColor = severityColor(issue.severity);
    doc
      .roundedRect(50, y, 60, 16, 4)
      .fill(badgeColor);
    doc
      .fontSize(7.5)
      .font("Helvetica-Bold")
      .fillColor("#ffffff")
      .text(issue.severity.toUpperCase(), 52, y + 4, { width: 56, align: "center" });

    // Category chip
    doc
      .roundedRect(118, y, 70, 16, 4)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();
    doc
      .fontSize(7.5)
      .font("Helvetica")
      .fillColor(COLORS.muted)
      .text(issue.category.replace(/_/g, " ").toUpperCase(), 120, y + 4, { width: 66, align: "center" });

    // Priority score (right-aligned)
    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor(COLORS.muted)
      .text(`Priority: ${Math.round(issue.priorityScore ?? 0)}/100`, 50, y, { width: pageWidth, align: "right" });

    y += 22;

    // Title
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor(COLORS.dark)
      .text(issue.title, 50, y, { width: pageWidth });
    y += 16;

    // Description
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(COLORS.muted)
      .text(issue.description, 50, y, { width: pageWidth, lineGap: 2 });
    y += descHeight + 6;

    // Recommendation
    if (issue.recommendation) {
      doc
        .fontSize(9)
        .font("Helvetica-Oblique")
        .fillColor(COLORS.primary)
        .text(`Recommendation: ${issue.recommendation}`, 50, y, { width: pageWidth, lineGap: 2 });
      y += recHeight + 4;
    }

    // AI recommendation (if present and approved)
    if (issue.aiRecommendation && issue.status === "approved") {
      const aiHeight = Math.min(doc.fontSize(8.5).heightOfString(issue.aiRecommendation, { width: pageWidth - 20 }), 80);
      if (y + aiHeight + 20 > doc.page.height - 70) {
        doc.addPage();
        y = 50;
      }
      doc
        .rect(50, y, pageWidth, aiHeight + 16)
        .fill("#f0fdf4");
      doc
        .fontSize(7.5)
        .font("Helvetica-Bold")
        .fillColor(COLORS.primary)
        .text("AI RECOMMENDATION", 60, y + 5);
      doc
        .fontSize(8.5)
        .font("Helvetica")
        .fillColor(COLORS.dark)
        .text(issue.aiRecommendation, 60, y + 16, { width: pageWidth - 20, lineGap: 2 });
      y += aiHeight + 20;
    }

    // Divider
    doc
      .moveTo(50, y + 6)
      .lineTo(doc.page.width - 50, y + 6)
      .stroke(COLORS.border);
    y += 18;
  }

  // ─── Footer on every page ─────────────────────────────────────────────────
  const totalPages = (doc as any).bufferedPageRange?.()?.count ?? 1;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor(COLORS.muted)
      .text(
        `SEORx Audit Report - ${data.clientName} - ${data.generatedAt.toLocaleDateString()} - Page ${i + 1}`,
        50,
        doc.page.height - 35,
        { width: pageWidth, align: "center" },
      );
  }

  doc.end();
  return doc as unknown as Readable;
}

export function generateGeoAeoPdfReport(payload: GeoAeoReportPayload): Readable {
  const doc = new PDFDocument({
    margin: 50,
    size: "A4",
    bufferPages: true,
    info: { Title: payload.title, Author: "SEORx" },
  });
  const pageWidth = doc.page.width - 100;

  doc.rect(0, 0, doc.page.width, 165).fill(COLORS.dark);
  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(26)
    .text(payload.title, 50, 42, { width: pageWidth });
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#d1d5db")
    .text(payload.subtitle, 50, 78, { width: pageWidth });
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("#ffffff")
    .text(payload.profile?.businessName ?? payload.client.name, 50, 116, { width: pageWidth });

  const metaY = 190;
  const score = payload.score.aiVisibilityScore;
  const cards = [
    { label: "AI Visibility", value: `${score}/100`, color: scoreColor(score) },
    { label: "Grade", value: payload.score.grade, color: COLORS.dark },
    { label: "Approved Issues", value: String(payload.approvedIssues.length), color: COLORS.primary },
    { label: "Approved Observations", value: String(payload.observations.length), color: COLORS.medium },
  ];

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text("Website", 50, metaY)
    .text("Generated", 230, metaY)
    .text("Package", 380, metaY);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(COLORS.dark)
    .text(payload.profile?.websiteUrl ?? payload.audit.url, 50, metaY + 14, { width: 160 })
    .text(payload.generatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), 230, metaY + 14, { width: 130 })
    .text(payload.profile?.packageTier ?? "standard", 380, metaY + 14, { width: 120 });

  const cardY = metaY + 55;
  cards.forEach((card, index) => {
    const x = 50 + index * 130;
    doc.roundedRect(x, cardY, 115, 64, 6).strokeColor(COLORS.border).lineWidth(1).stroke();
    doc.font("Helvetica-Bold").fontSize(20).fillColor(card.color).text(card.value, x + 12, cardY + 13, { width: 91 });
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted).text(card.label, x + 12, cardY + 44, { width: 91 });
  });

  let y = cardY + 92;
  y = section(doc, "Executive Summary", y);
  y = paragraph(
    doc,
    `This AI Visibility Audit gives ${payload.client.name} an overall score of ${score}/100 (${payload.score.grade}). It summarizes approved evidence only and highlights the highest-impact fixes for AI answer systems and search visibility.`,
    y,
    pageWidth,
  );
  y = list(doc, "Top blockers", payload.score.topRisks.slice(0, 3), y, pageWidth);
  y = list(doc, "Quick wins", payload.score.quickWins.slice(0, 3), y, pageWidth);

  doc.addPage();
  y = 50;
  y = section(doc, "Prompt and Observation Coverage", y);
  y = paragraph(doc, `${payload.prompts.length} prompts generated/tested. ${payload.observations.length} approved AI visibility observations are included.`, y, pageWidth);
  y = list(
    doc,
    "Approved observations",
    payload.observations.slice(0, 8).map((item) => `${readablePdfKey(item.surface)}: ${item.promptText ?? "Manual observation"} - brand mentioned: ${item.brandMentioned ? "yes" : "no"}, cited: ${item.brandCited ? "yes" : "no"}`),
    y,
    pageWidth,
  );

  y = section(doc, "Top GEO/AEO Recommendations", y);
  const recommendations = payload.recommendations.slice(0, 10);
  if (!recommendations.length) {
    y = paragraph(doc, "No approved GEO/AEO recommendations are available yet.", y, pageWidth);
  } else {
    for (const item of recommendations) {
      y = ensureSpace(doc, y, 95);
      doc.font("Helvetica-Bold").fontSize(10.5).fillColor(COLORS.dark).text(item.title, 50, y, { width: pageWidth });
      y += 16;
      doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted).text(`Priority ${item.priorityScore}/100 - ${item.category}`, 50, y, { width: pageWidth });
      y += 13;
      y = paragraph(doc, item.recommendation, y, pageWidth);
    }
  }

  y = section(doc, "30-Day Action Plan", y);
  for (const week of payload.actionPlan) {
    y = ensureSpace(doc, y, 95);
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(COLORS.dark).text(`${week.week}: ${week.focus}`, 50, y, { width: pageWidth });
    y += 16;
    for (const task of week.tasks) {
      y = paragraph(doc, `${task.task} Owner: ${task.owner}. Expected output: ${task.expectedOutput}`, y, pageWidth);
    }
  }

  y = section(doc, "Disclaimer", y);
  paragraph(doc, payload.disclaimer, y, pageWidth);

  const totalPages = (doc as any).bufferedPageRange?.()?.count ?? 1;
  for (let index = 0; index < totalPages; index++) {
    doc.switchToPage(index);
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor(COLORS.muted)
      .text(
        `SEORx AI Visibility Audit - ${payload.client.name} - Page ${index + 1}`,
        50,
        doc.page.height - 35,
        { width: pageWidth, align: "center" },
      );
  }

  doc.end();
  return doc as unknown as Readable;
}

function section(doc: PDFKit.PDFDocument, title: string, y: number): number {
  y = ensureSpace(doc, y, 55);
  doc.font("Helvetica-Bold").fontSize(14).fillColor(COLORS.dark).text(title, 50, y);
  return y + 24;
}

function paragraph(doc: PDFKit.PDFDocument, text: string, y: number, width: number): number {
  y = ensureSpace(doc, y, 70);
  const height = doc.font("Helvetica").fontSize(9.5).heightOfString(text, { width, lineGap: 3 });
  doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.muted).text(text, 50, y, { width, lineGap: 3 });
  return y + height + 10;
}

function list(doc: PDFKit.PDFDocument, title: string, values: string[], y: number, width: number): number {
  y = ensureSpace(doc, y, 70);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.dark).text(title, 50, y, { width });
  y += 16;
  const items = values.length ? values : ["No items recorded yet."];
  for (const value of items) {
    y = ensureSpace(doc, y, 32);
    const text = `- ${value}`;
    const height = doc.font("Helvetica").fontSize(9).heightOfString(text, { width, lineGap: 2 });
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted).text(text, 50, y, { width, lineGap: 2 });
    y += height + 5;
  }
  return y + 8;
}

function ensureSpace(doc: PDFKit.PDFDocument, y: number, needed: number): number {
  if (y + needed <= doc.page.height - 70) return y;
  doc.addPage();
  return 50;
}

function readablePdfKey(key: string): string {
  return key.replace(/_/g, " ").replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`).trim();
}
