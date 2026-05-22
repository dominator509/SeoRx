import PDFDocument from "pdfkit";
import type { Readable } from "stream";
import type { AuditIssue, Audit } from "@workspace/db";

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
