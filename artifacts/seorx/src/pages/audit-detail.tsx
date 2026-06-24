import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  useGetAudit, useListAuditIssues, useApproveIssue, useDismissIssue, useGetPageSpeedResults,
  useGetGeoAeoOverview, useApproveGeoAeoRecommendation, useUpdateGeoAeoRecommendation,
  useCreateGeoAeoScoreSnapshot, useCreateReport,
  getGetAuditQueryKey, getListAuditIssuesQueryKey, getGetPageSpeedResultsQueryKey,
  getGetGeoAeoOverviewQueryKey, getListReportsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Zap, Clock, FileText, Edit3, EyeOff, RefreshCw } from "lucide-react";
import { format } from "date-fns";

function seoRing(score?: number | null, label?: string) {
  if (score == null || Number.isNaN(score) || score <= 0) return null;
  const color = score >= 70 ? "#00b86b" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="26" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
          <circle cx="32" cy="32" r="26" fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${(score / 100) * 163} 163`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color }}>{score}</span>
        </div>
      </div>
      {label && <span className="text-[10px] text-muted-foreground text-center leading-tight">{label}</span>}
    </div>
  );
}

function severityBadge(severity: string) {
  const map: Record<string, string> = {
    critical: "bg-red-100 text-red-700 border-red-200",
    high: "bg-orange-100 text-orange-700 border-orange-200",
    medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
    low: "bg-blue-100 text-blue-700 border-blue-200",
    info: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return <Badge variant="outline" className={`text-[10px] font-semibold uppercase ${map[severity] ?? map.info}`}>{severity}</Badge>;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    open: "bg-gray-100 text-gray-700 border-gray-200",
    approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dismissed: "bg-gray-100 text-gray-400 border-gray-200",
    fixed: "bg-blue-100 text-blue-700 border-blue-200",
  };
  return <Badge variant="outline" className={`text-[10px] font-semibold ${map[status] ?? ""}`}>{status}</Badge>;
}

function auditTypeBadge(auditType?: string | null) {
  const label = auditType === "geo_aeo" ? "GEO/AEO" : auditType === "hybrid" ? "Hybrid" : "SEO";
  const cls = auditType === "geo_aeo"
    ? "bg-violet-100 text-violet-700 border-violet-200"
    : auditType === "hybrid"
      ? "bg-cyan-100 text-cyan-700 border-cyan-200"
      : "bg-gray-100 text-gray-600 border-gray-200";
  return <Badge variant="outline" className={`text-[10px] font-semibold ${cls}`}>{label}</Badge>;
}

function recommendationStatusBadge(status?: string) {
  const map: Record<string, string> = {
    draft: "bg-blue-100 text-blue-700 border-blue-200",
    approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
    hidden: "bg-gray-100 text-gray-500 border-gray-200",
  };
  return <Badge variant="outline" className={`text-[10px] font-semibold ${map[status ?? "draft"] ?? ""}`}>{status ?? "draft"}</Badge>;
}

function metricValue(value: any, kind: "ms" | "seconds" | "ratio") {
  const num = Number(value);
  if (value == null || Number.isNaN(num) || num <= 0) return "-";
  // fcp / lcp / ttfb / speedIndex are stored in seconds already (not ms)
  if (kind === "seconds") return `${num.toFixed(2)}s`;
  if (kind === "ratio") return num.toFixed(3);
  return `${Math.round(num)}ms`;
}

function metricCard(label: string, value: string, desc: string) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 min-w-0">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-xl font-bold text-foreground mt-1 ${value === "-" ? "tracking-widest" : ""}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{desc}</div>
    </div>
  );
}

function readableKey(value: string) {
  return value.replace(/_/g, " ").replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`).trim();
}

export default function AuditDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [approveId, setApproveId] = useState<string | null>(null);
  const [dismissId, setDismissId] = useState<string | null>(null);
  const [editRecommendation, setEditRecommendation] = useState<any | null>(null);

  const { data: audit, isLoading: auditLoading } = useGetAudit(id!, {
    query: { enabled: !!id, queryKey: getGetAuditQueryKey(id!) },
  });
  const auditData = audit as any;
  const isGeoAudit = auditData?.auditType === "geo_aeo" || auditData?.auditType === "hybrid";

  const { data: geoOverview, isLoading: geoLoading, error: geoError } = useGetGeoAeoOverview(id!, {
    query: {
      enabled: !!id && isGeoAudit,
      queryKey: getGetGeoAeoOverviewQueryKey(id!),
      retry: false,
    },
  });

  const issueParams: any = {};
  if (severityFilter !== "all") issueParams.severity = severityFilter;
  if (statusFilter !== "all") issueParams.status = statusFilter;

  const { data: issues, isLoading: issuesLoading } = useListAuditIssues(
    id!, issueParams,
    { query: { enabled: !!id, queryKey: getListAuditIssuesQueryKey(id!, issueParams) } },
  );

  const { data: pagespeed } = useGetPageSpeedResults(id!, {
    query: { enabled: !!id && audit?.status === "completed", queryKey: getGetPageSpeedResultsQueryKey(id!) },
  });

  const approveIssue = useApproveIssue({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAuditIssuesQueryKey(id!) });
        setApproveId(null);
        toast({ title: "Approved", description: "Issue marked as approved." });
      },
    },
  });
  const dismissIssue = useDismissIssue({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAuditIssuesQueryKey(id!) });
        setDismissId(null);
        toast({ title: "Dismissed", description: "Issue dismissed." });
      },
    },
  });
  const approveGeoRecommendation = useApproveGeoAeoRecommendation({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetGeoAeoOverviewQueryKey(id!) });
        qc.invalidateQueries({ queryKey: getListAuditIssuesQueryKey(id!) });
        toast({ title: "Approved", description: "GEO/AEO recommendation added to approved issues." });
      },
      onError: () => toast({ title: "Error", description: "Failed to approve recommendation.", variant: "destructive" }),
    },
  });
  const updateGeoRecommendation = useUpdateGeoAeoRecommendation({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetGeoAeoOverviewQueryKey(id!) });
        setEditRecommendation(null);
        toast({ title: "Updated", description: "GEO/AEO recommendation updated." });
      },
      onError: () => toast({ title: "Error", description: "Failed to update recommendation.", variant: "destructive" }),
    },
  });
  const createGeoScore = useCreateGeoAeoScoreSnapshot({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetGeoAeoOverviewQueryKey(id!) });
        qc.invalidateQueries({ queryKey: getGetAuditQueryKey(id!) });
        toast({ title: "Score updated", description: "AI Visibility score recalculated." });
      },
      onError: () => toast({ title: "Error", description: "Failed to recalculate GEO/AEO score.", variant: "destructive" }),
    },
  });
  const createReport = useCreateReport({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListReportsQueryKey() });
        toast({ title: "Report generating", description: "GEO/AEO Markdown report will be ready shortly." });
      },
      onError: () => toast({ title: "Error", description: "Failed to generate GEO/AEO report.", variant: "destructive" }),
    },
  });

  useEffect(() => {
    if (audit?.status !== "running" && audit?.status !== "pending") return;
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: getGetAuditQueryKey(id!) });
    }, 5000);
    return () => clearInterval(interval);
  }, [audit?.status, id, qc]);

  if (auditLoading) {
    return <div className="p-4 sm:p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>;
  }
  if (!audit) return <div className="p-4 sm:p-6 text-muted-foreground">Audit not found.</div>;

  const ps = pagespeed as any;
  const geo = geoOverview as any;
  const geoScore = geo?.latestScore;
  const geoRecommendations = (geo?.recommendations ?? []) as any[];
  const visibleGeoRecommendations = geoRecommendations.filter((item) => item.status !== "hidden");
  const coreVitals = [
    { label: "FCP", value: metricValue(ps?.fcp, "seconds"), desc: "First Contentful Paint" },
    { label: "LCP", value: metricValue(ps?.lcp, "seconds"), desc: "Largest Contentful Paint" },
    { label: "CLS", value: metricValue(ps?.cls, "ratio"), desc: "Cumulative Layout Shift" },
    { label: "TBT", value: metricValue((ps as any)?.totalBlockingTime ?? ps?.tbt, "ms"), desc: "Total Blocking Time" },
    { label: "TTFB", value: metricValue(ps?.ttfb, "seconds"), desc: "Time to First Byte" },
  ];
  const isEstimated = !!ps && !ps.isReal;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      <Link href="/audits">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
          <ArrowLeft className="w-4 h-4" />All Audits
        </Button>
      </Link>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-lg sm:text-xl font-bold text-foreground">{auditData.clientName}</h1>
                <Badge variant="outline" className={`text-[10px] font-semibold ${
                  audit.status === "completed" ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                  : audit.status === "running" ? "bg-blue-100 text-blue-700 border-blue-200 animate-pulse"
                  : "bg-gray-100 text-gray-600 border-gray-200"
                }`}>{audit.status}</Badge>
                {auditTypeBadge(auditData.auditType)}
              </div>
              <div className="text-sm text-muted-foreground break-all mb-3">{audit.url}</div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {audit.crawledPages != null && <span>{audit.crawledPages} pages crawled</span>}
                {audit.scanDurationMs != null && <span><Clock className="w-3 h-3 inline mr-1" />{(audit.scanDurationMs / 1000).toFixed(1)}s scan</span>}
                {audit.completedAt && <span>Completed {format(new Date(audit.completedAt), "MMM d, yyyy HH:mm")}</span>}
              </div>
            </div>
            <div className="flex gap-4 flex-wrap sm:flex-nowrap sm:flex-shrink-0">
              {seoRing(audit.seoScore, "SEO Score")}
              {seoRing(auditData.aiVisibilityScore, "AI Visibility")}
              {seoRing(auditData.criticalCount != null ? (100 - auditData.criticalCount * 10) : null, "Health")}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border">
            {[
              { label: "Critical", count: auditData.criticalCount, color: "text-red-500 bg-red-50 border-red-100" },
              { label: "High", count: auditData.highCount, color: "text-orange-500 bg-orange-50 border-orange-100" },
              { label: "Medium", count: auditData.mediumCount, color: "text-yellow-500 bg-yellow-50 border-yellow-100" },
              { label: "Low", count: auditData.lowCount, color: "text-blue-500 bg-blue-50 border-blue-100" },
            ].map(({ label, count, color }) => (
              <div key={label} className={`rounded-lg border p-3 text-center ${color}`}>
                <div className="text-xl font-bold">{count ?? 0}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="issues">
        <TabsList className={`w-full sm:w-auto grid ${isGeoAudit ? "grid-cols-3" : "grid-cols-2"}`}>
          <TabsTrigger value="issues">Issues ({auditData.issueCount ?? 0})</TabsTrigger>
          {isGeoAudit && <TabsTrigger value="geo" data-testid="geo-aeo-tab">GEO/AEO</TabsTrigger>}
          <TabsTrigger value="pagespeed" data-testid="pagespeed-tab">PageSpeed</TabsTrigger>
        </TabsList>

        <TabsContent value="issues" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-full sm:w-36" data-testid="audit-severity-filter"><SelectValue placeholder="All severities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36" data-testid="audit-status-filter"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {issuesLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
          ) : !(issues as any[])?.length ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No issues found.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {(issues as any[]).map((issue: any) => (
                <Card key={issue.id} className={issue.status === "dismissed" ? "opacity-60" : ""} data-testid={`issue-card-${issue.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        issue.severity === "critical" ? "text-red-500"
                        : issue.severity === "high" ? "text-orange-500"
                        : issue.severity === "medium" ? "text-yellow-500"
                        : "text-blue-500"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold text-sm text-foreground">{issue.title}</span>
                          {severityBadge(issue.severity)}
                          {statusBadge(issue.status)}
                          {issue.category && <Badge variant="secondary" className="text-[10px]">{issue.category?.replace(/_/g, " ")}</Badge>}
                          {issue.priorityScore != null && <span className="text-[10px] font-bold text-muted-foreground">Priority: {issue.priorityScore}/100</span>}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2 leading-relaxed">{issue.description}</p>
                        <div className="bg-muted/50 rounded-md p-3 mb-2">
                          <p className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1"><Zap className="w-3 h-3 text-primary" />Recommendation</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{issue.recommendation}</p>
                        </div>
                        {issue.aiRecommendation && (
                          <div className="bg-primary/5 border border-primary/20 rounded-md p-3">
                            <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1"><Zap className="w-3 h-3" />AI Analysis</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{issue.aiRecommendation}</p>
                          </div>
                        )}
                      </div>
                      {issue.status === "open" && (
                        <div className="flex flex-col sm:flex-row gap-1.5 flex-shrink-0">
                          <Button size="sm" variant="outline" className="gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 h-7 text-xs" onClick={() => setApproveId(issue.id)} data-testid={`approve-issue-${issue.id}`}>
                            <CheckCircle className="w-3.5 h-3.5" />Approve
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1 text-gray-500 h-7 text-xs" onClick={() => setDismissId(issue.id)} data-testid={`dismiss-issue-${issue.id}`}>
                            <XCircle className="w-3.5 h-3.5" />Dismiss
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {isGeoAudit && (
          <TabsContent value="geo" className="space-y-4 mt-4">
            {geoLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
            ) : geoError ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">GEO/AEO is not available for this audit right now.</CardContent></Card>
            ) : (
              <>
                <Card>
                  <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-semibold">AI Visibility Review</h2>
                        {geoScore && <Badge variant="outline" className="text-[10px]">{geoScore.grade}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {(geo?.prompts?.length ?? 0)} prompts, {(geo?.observations?.length ?? 0)} observations, {visibleGeoRecommendations.length} visible recommendations
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {seoRing(geoScore?.aiVisibilityScore ?? auditData.aiVisibilityScore, "AI Visibility")}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => createGeoScore.mutate({ id: id! })}
                        disabled={createGeoScore.isPending}
                        data-testid="recalculate-geo-score"
                      >
                        <RefreshCw className="w-4 h-4" />Score
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => createReport.mutate({
                          data: {
                            auditId: id!,
                            title: `${auditData.clientName} AI Visibility Audit`,
                            reportType: "geo_aeo_audit",
                            format: "markdown",
                          } as any,
                        })}
                        disabled={createReport.isPending}
                        data-testid="generate-geo-report"
                      >
                        <FileText className="w-4 h-4" />Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {geoScore && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader><CardTitle className="text-sm font-semibold">Quick Wins</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {(geoScore.quickWins?.length ? geoScore.quickWins : ["No quick wins recorded yet."]).map((win: string) => (
                          <div key={win} className="text-sm text-muted-foreground">{win}</div>
                        ))}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader><CardTitle className="text-sm font-semibold">Top Risks</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {(geoScore.topRisks?.length ? geoScore.topRisks : ["No top risks recorded yet."]).map((risk: string) => (
                          <div key={risk} className="text-sm text-muted-foreground">{risk}</div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                )}

                <Card>
                  <CardHeader><CardTitle className="text-sm font-semibold">Recommendations</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    {!geoRecommendations.length ? (
                      <div className="py-10 text-center text-sm text-muted-foreground">No GEO/AEO recommendations yet.</div>
                    ) : (
                      <div className="divide-y divide-border">
                        {geoRecommendations.map((rec) => (
                          <div key={rec.id} className={`p-4 ${rec.status === "hidden" ? "opacity-60" : ""}`} data-testid={`geo-recommendation-${rec.id}`}>
                            <div className="flex flex-col xl:flex-row xl:items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="font-semibold text-sm text-foreground">{rec.title}</span>
                                  {recommendationStatusBadge(rec.status)}
                                  <Badge variant="secondary" className="text-[10px]">{readableKey(rec.category ?? "geo")}</Badge>
                                  <span className="text-[10px] font-bold text-muted-foreground">Priority: {rec.priorityScore}/100</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed mb-2">{rec.evidence}</p>
                                <div className="bg-muted/50 rounded-md p-3">
                                  <p className="text-xs font-semibold text-foreground mb-1">Recommended fix</p>
                                  <p className="text-xs text-muted-foreground leading-relaxed">{rec.recommendation}</p>
                                </div>
                                {(rec.aiVisibilityImpact || rec.businessImpact) && (
                                  <div className="grid sm:grid-cols-2 gap-2 mt-2">
                                    {rec.aiVisibilityImpact && <div className="text-xs text-muted-foreground bg-primary/5 border border-primary/15 rounded-md p-2">{rec.aiVisibilityImpact}</div>}
                                    {rec.businessImpact && <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">{rec.businessImpact}</div>}
                                  </div>
                                )}
                              </div>
                              <div className="flex xl:flex-col gap-1.5 flex-wrap xl:flex-shrink-0">
                                {rec.status !== "approved" && rec.status !== "hidden" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 h-7 text-xs"
                                    onClick={() => approveGeoRecommendation.mutate({ id: id!, recommendationId: rec.id })}
                                    disabled={approveGeoRecommendation.isPending}
                                    data-testid={`approve-geo-recommendation-${rec.id}`}
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />Approve
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 h-7 text-xs"
                                  onClick={() => setEditRecommendation({
                                    id: rec.id,
                                    title: rec.title,
                                    evidence: rec.evidence,
                                    recommendation: rec.recommendation,
                                    priorityScore: rec.priorityScore,
                                  })}
                                  data-testid={`edit-geo-recommendation-${rec.id}`}
                                >
                                  <Edit3 className="w-3.5 h-3.5" />Edit
                                </Button>
                                {rec.status !== "hidden" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1 text-gray-500 h-7 text-xs"
                                    onClick={() => updateGeoRecommendation.mutate({ id: id!, recommendationId: rec.id, data: { status: "hidden" } as any })}
                                    disabled={updateGeoRecommendation.isPending}
                                    data-testid={`hide-geo-recommendation-${rec.id}`}
                                  >
                                    <EyeOff className="w-3.5 h-3.5" />Hide
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-sm font-semibold">Prompt Set</CardTitle></CardHeader>
                    <CardContent className="space-y-2 max-h-72 overflow-y-auto">
                      {geo?.prompts?.length ? geo.prompts.slice(0, 12).map((prompt: any) => (
                        <div key={prompt.id} className="text-xs text-muted-foreground border border-border rounded-md p-2">
                          <div className="font-medium text-foreground">{prompt.promptText}</div>
                          <div className="mt-1">{readableKey(prompt.intent)} - Priority {prompt.priority}/100</div>
                        </div>
                      )) : <div className="text-sm text-muted-foreground">No prompts generated yet.</div>}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-sm font-semibold">Approved Observations</CardTitle></CardHeader>
                    <CardContent className="space-y-2 max-h-72 overflow-y-auto">
                      {geo?.observations?.filter((item: any) => item.approved).length ? geo.observations.filter((item: any) => item.approved).map((observation: any) => (
                        <div key={observation.id} className="text-xs text-muted-foreground border border-border rounded-md p-2">
                          <div className="font-medium text-foreground">{readableKey(observation.surface)}</div>
                          <div className="mt-1">Mentioned: {observation.brandMentioned ? "yes" : "no"} - Cited: {observation.brandCited ? "yes" : "no"} - Confidence {observation.confidenceScore}/100</div>
                        </div>
                      )) : <div className="text-sm text-muted-foreground">No approved observations yet.</div>}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>
        )}

        <TabsContent value="pagespeed" className="mt-4">
          {!pagespeed ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
              {audit.status !== "completed" ? "PageSpeed data available after audit completes." : "No PageSpeed data available."}
            </CardContent></Card>
          ) : (
            <div className="space-y-4">
              {isEstimated && (
                <Card>
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    These metrics are estimated because live PageSpeed data wasn't available for this run.
                  </CardContent>
                </Card>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Performance", score: ps?.performanceScore },
                  { label: "Accessibility", score: ps?.accessibilityScore },
                  { label: "Best Practices", score: ps?.bestPracticesScore },
                  { label: "SEO", score: ps?.seoScore },
                ].map(({ label, score }) => (
                  <Card key={label}><CardContent className="p-4 flex flex-col items-center gap-2">{seoRing(score)}<span className="text-xs text-muted-foreground font-medium text-center">{label}</span></CardContent></Card>
                ))}
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm font-semibold">Core Web Vitals</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {coreVitals.map(({ label, value, desc }) => metricCard(label, value, desc))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!approveId} onOpenChange={(o) => !o && setApproveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Issue</AlertDialogTitle>
            <AlertDialogDescription>Mark this issue as approved. The fix recommendation will be confirmed and tracked.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-emerald-600 hover:bg-emerald-700" onClick={() => approveId && approveIssue.mutate({ id: approveId, data: {} })} data-testid="confirm-approve">Approve</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editRecommendation} onOpenChange={(open) => !open && setEditRecommendation(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Edit GEO/AEO Recommendation</DialogTitle></DialogHeader>
          {editRecommendation && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={editRecommendation.title}
                  onChange={(event) => setEditRecommendation({ ...editRecommendation, title: event.target.value })}
                  data-testid="edit-geo-title"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Evidence</label>
                <Textarea
                  value={editRecommendation.evidence}
                  onChange={(event) => setEditRecommendation({ ...editRecommendation, evidence: event.target.value })}
                  rows={4}
                  data-testid="edit-geo-evidence"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Recommended Fix</label>
                <Textarea
                  value={editRecommendation.recommendation}
                  onChange={(event) => setEditRecommendation({ ...editRecommendation, recommendation: event.target.value })}
                  rows={4}
                  data-testid="edit-geo-recommendation"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editRecommendation.priorityScore}
                  onChange={(event) => setEditRecommendation({ ...editRecommendation, priorityScore: Number(event.target.value) })}
                  data-testid="edit-geo-priority"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRecommendation(null)}>Cancel</Button>
            <Button
              onClick={() => editRecommendation && updateGeoRecommendation.mutate({
                id: id!,
                recommendationId: editRecommendation.id,
                data: {
                  title: editRecommendation.title,
                  evidence: editRecommendation.evidence,
                  recommendation: editRecommendation.recommendation,
                  priorityScore: editRecommendation.priorityScore,
                } as any,
              })}
              disabled={updateGeoRecommendation.isPending}
              data-testid="save-geo-recommendation"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!dismissId} onOpenChange={(o) => !o && setDismissId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss Issue</AlertDialogTitle>
            <AlertDialogDescription>Dismiss this issue. It will no longer appear in open issues.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => dismissId && dismissIssue.mutate({ id: dismissId, data: {} })} data-testid="confirm-dismiss">Dismiss</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
