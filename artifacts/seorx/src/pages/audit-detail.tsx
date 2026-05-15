import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  useGetAudit, useListAuditIssues, useApproveIssue, useDismissIssue, useGetPageSpeedResults,
  getGetAuditQueryKey, getListAuditIssuesQueryKey, getGetPageSpeedResultsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Zap, Clock } from "lucide-react";
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

export default function AuditDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [approveId, setApproveId] = useState<string | null>(null);
  const [dismissId, setDismissId] = useState<string | null>(null);

  const { data: audit, isLoading: auditLoading } = useGetAudit(id!, {
    query: { enabled: !!id, queryKey: getGetAuditQueryKey(id!) },
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

  const auditData = audit as any;
  const ps = pagespeed as any;
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
        <TabsList className="w-full sm:w-auto grid grid-cols-2">
          <TabsTrigger value="issues">Issues ({auditData.issueCount ?? 0})</TabsTrigger>
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
