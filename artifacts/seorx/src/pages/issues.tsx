import { useState } from "react";
import {
  useListAudits, useListAuditIssues, useApproveIssue, useDismissIssue,
  getListAuditsQueryKey, getListAuditIssuesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, XCircle, Zap } from "lucide-react";
import { Link } from "wouter";

function severityBadge(s: string) {
  const map: Record<string, string> = {
    critical: "bg-red-100 text-red-700 border-red-200",
    high: "bg-orange-100 text-orange-700 border-orange-200",
    medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
    low: "bg-blue-100 text-blue-700 border-blue-200",
  };
  return <Badge variant="outline" className={`text-[10px] font-semibold uppercase ${map[s] ?? ""}`}>{s}</Badge>;
}

function IssuesList({ auditId, auditClientName, severity, status, onApprove, onDismiss }: {
  auditId: string; auditClientName: string; severity: string; status: string;
  onApprove: (id: string) => void; onDismiss: (id: string) => void;
}) {
  const params: any = {};
  if (severity !== "all") params.severity = severity;
  if (status !== "all") params.status = status;

  const { data: issues, isLoading } = useListAuditIssues(auditId, params, {
    query: { queryKey: getListAuditIssuesQueryKey(auditId, params) },
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!(issues as any[])?.length) return null;

  return (
    <>
      {(issues as any[]).map((issue: any) => (
        <Card key={issue.id} className={`${issue.status === "dismissed" ? "opacity-60" : ""}`} data-testid={`issue-card-${issue.id}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                issue.severity === "critical" ? "text-red-500"
                : issue.severity === "high" ? "text-orange-500"
                : issue.severity === "medium" ? "text-yellow-500"
                : "text-blue-500"
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-sm">{issue.title}</span>
                  {severityBadge(issue.severity)}
                  <Badge variant="secondary" className="text-[10px]">{issue.category?.replace(/_/g, " ")}</Badge>
                  <Link href={`/audits/${auditId}`}>
                    <span className="text-xs text-muted-foreground hover:text-primary">{auditClientName}</span>
                  </Link>
                </div>
                <p className="text-sm text-muted-foreground">{issue.description}</p>
                {issue.aiRecommendation && (
                  <div className="mt-2 bg-primary/5 border border-primary/20 rounded-md p-2.5">
                    <p className="text-xs font-semibold text-primary flex items-center gap-1 mb-1"><Zap className="w-3 h-3" />AI Analysis</p>
                    <p className="text-xs text-muted-foreground">{issue.aiRecommendation}</p>
                  </div>
                )}
              </div>
              {issue.status === "open" && (
                <div className="flex gap-1.5 flex-shrink-0">
                  <Button size="sm" variant="outline" className="gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 h-7 text-xs" onClick={() => onApprove(issue.id)} data-testid={`approve-${issue.id}`}>
                    <CheckCircle className="w-3.5 h-3.5" />Approve
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => onDismiss(issue.id)} data-testid={`dismiss-${issue.id}`}>
                    <XCircle className="w-3.5 h-3.5" />Dismiss
                  </Button>
                </div>
              )}
              {issue.status !== "open" && (
                <Badge variant="outline" className={`text-[10px] h-6 ${issue.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                  {issue.status}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

export default function Issues() {
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("open");
  const [approveId, setApproveId] = useState<string | null>(null);
  const [dismissId, setDismissId] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading: auditsLoading } = useListAudits(
    { status: "completed" } as any,
    { query: { queryKey: getListAuditsQueryKey({ status: "completed" }) } },
  );

  const completedAudits = (data as any)?.items ?? data ?? [];

  const approveIssue = useApproveIssue({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["listAuditIssues"] });
        setApproveId(null);
        toast({ title: "Approved", description: "Issue approved." });
      },
    },
  });
  const dismissIssue = useDismissIssue({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["listAuditIssues"] });
        setDismissId(null);
        toast({ title: "Dismissed", description: "Issue dismissed." });
      },
    },
  });

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Issues</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All SEO issues across completed audits</p>
      </div>

      <div className="flex gap-2">
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {auditsLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : !completedAudits.length ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No completed audits yet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {completedAudits.map((audit: any) => (
            <IssuesList
              key={audit.id}
              auditId={audit.id}
              auditClientName={audit.clientName}
              severity={severity}
              status={status}
              onApprove={setApproveId}
              onDismiss={setDismissId}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!approveId} onOpenChange={(o) => !o && setApproveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Approve Issue</AlertDialogTitle><AlertDialogDescription>Confirm the fix recommendation for this issue.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-emerald-600 hover:bg-emerald-700" onClick={() => approveId && approveIssue.mutate({ id: approveId, data: {} })}>Approve</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!dismissId} onOpenChange={(o) => !o && setDismissId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Dismiss Issue</AlertDialogTitle><AlertDialogDescription>This issue will be marked as dismissed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => dismissId && dismissIssue.mutate({ id: dismissId, data: {} })}>Dismiss</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
