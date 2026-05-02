import { useParams, Link } from "wouter";
import { useGetReport, getGetReportQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Download, FileText, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: report, isLoading } = useGetReport(id!, {
    query: { enabled: !!id, queryKey: getGetReportQueryKey(id!) },
  });

  if (isLoading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div>;
  }
  if (!report) return <div className="p-6 text-muted-foreground">Report not found.</div>;

  const r = report as any;

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <Link href="/reports">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
          <ArrowLeft className="w-4 h-4" />All Reports
        </Button>
      </Link>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">{report.title}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className={`text-[10px] font-semibold ${report.status === "ready" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : report.status === "generating" ? "bg-blue-100 text-blue-700 animate-pulse" : ""}`}>
                  {report.status}
                </Badge>
                <Badge variant="outline" className="text-[10px] uppercase">{report.format}</Badge>
                <span className="text-xs text-muted-foreground">{r.clientName}</span>
                <span className="text-xs text-muted-foreground">{format(new Date(report.createdAt), "MMM d, yyyy")}</span>
              </div>
            </div>
            {report.status === "ready" && report.downloadUrl && (
              <a href={report.downloadUrl}>
                <Button size="sm" variant="outline" className="gap-1.5" data-testid="download-report">
                  <Download className="w-4 h-4" />Download
                </Button>
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {report.summary && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Executive Summary</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{report.summary}</p>
          </CardContent>
        </Card>
      )}

      {r.topIssues?.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Top Priority Issues</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {r.topIssues.map((issue: any, i: number) => (
                <div key={issue.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-muted-foreground mt-0.5">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium">{issue.title}</span>
                      <Badge variant="outline" className={`text-[10px] font-semibold uppercase ${
                        issue.severity === "critical" ? "bg-red-100 text-red-700 border-red-200"
                        : issue.severity === "high" ? "bg-orange-100 text-orange-700 border-orange-200"
                        : "bg-yellow-100 text-yellow-700 border-yellow-200"
                      }`}>{issue.severity}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{issue.recommendation}</p>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground flex-shrink-0">P{issue.priorityScore}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
