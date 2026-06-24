import { useParams, Link } from "wouter";
import { format } from "date-fns";
import { useGetClientAiVisibility, getGetClientAiVisibilityQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Download, FileText, Globe, Search, ShieldCheck, Sparkles, Target } from "lucide-react";

function scoreColor(score?: number | null) {
  if (score == null) return "#64748b";
  if (score >= 80) return "#059669";
  if (score >= 60) return "#0d9488";
  if (score >= 40) return "#d97706";
  return "#dc2626";
}

function scoreRing(score?: number | null) {
  const value = Math.max(0, Math.min(100, Math.round(score ?? 0)));
  const color = scoreColor(score);
  return (
    <div className="relative h-24 w-24">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96" aria-hidden="true">
        <circle cx="48" cy="48" r="38" fill="none" stroke="hsl(var(--muted))" strokeWidth="9" />
        <circle
          cx="48"
          cy="48"
          r="38"
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeDasharray={`${(value / 100) * 239} 239`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>{score == null ? "-" : value}</span>
      </div>
    </div>
  );
}

function readableKey(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

export default function ClientAiVisibility() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useGetClientAiVisibility(id!, {
    query: { enabled: !!id, queryKey: getGetClientAiVisibilityQueryKey(id!) },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">AI Visibility is unavailable for this client.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href={`/clients/${data.client.id}`}>
            <Button variant="ghost" size="sm" className="-ml-2 gap-1.5">
              <ArrowLeft className="h-4 w-4" />Client
            </Button>
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{data.client.name}</h1>
            <Badge variant="outline" className="gap-1">
              <Sparkles className="h-3 w-3" />AI Visibility
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Globe className="h-3.5 w-3.5" />{data.client.domain}
          </div>
        </div>
        {data.latestReport?.downloadUrl && (
          <a href={data.latestReport.downloadUrl}>
            <Button className="w-full gap-1.5 sm:w-auto">
              <Download className="h-4 w-4" />Download Report
            </Button>
          </a>
        )}
      </div>

      {!data.available ? (
        <Card>
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">No approved AI visibility report yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Run a GEO/AEO or hybrid audit, approve recommendations, and generate the Markdown report to publish this view.
              </p>
            </div>
            <Link href={`/audits/new?clientId=${data.client.id}`}>
              <Button className="gap-1.5">
                <Search className="h-4 w-4" />New Audit
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.1fr_1.9fr]">
            <Card>
              <CardContent className="flex items-center gap-5 p-5">
                {scoreRing(data.score?.aiVisibilityScore)}
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">AI Visibility Score</div>
                  <div className="mt-1 text-xl font-semibold">{data.score?.grade ?? "Not scored"}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {data.latestAudit?.completedAt ? format(new Date(data.latestAudit.completedAt), "MMM d, yyyy") : "Latest completed audit"}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-4">
              <Card><CardContent className="p-4">
                <div className="text-2xl font-bold">{data.promptCoverage.totalPrompts}</div>
                <div className="mt-1 text-xs text-muted-foreground">Prompts reviewed</div>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <div className="text-2xl font-bold">{data.promptCoverage.approvedObservationCount}</div>
                <div className="mt-1 text-xs text-muted-foreground">Approved observations</div>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <div className="text-2xl font-bold">{data.promptCoverage.brandMentionedCount}</div>
                <div className="mt-1 text-xs text-muted-foreground">Brand mentions</div>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <div className="text-2xl font-bold">{data.promptCoverage.brandCitedCount}</div>
                <div className="mt-1 text-xs text-muted-foreground">Brand citations</div>
              </CardContent></Card>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><Target className="h-4 w-4" />Top Quick Wins</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(data.quickWins.length ? data.quickWins : ["No approved quick wins recorded yet."]).map((item) => (
                  <div key={item} className="rounded-md border border-border px-3 py-2 text-sm">{item}</div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4" />Top Risks</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(data.topRisks.length ? data.topRisks : ["No approved risks recorded yet."]).map((item) => (
                  <div key={item} className="rounded-md border border-border px-3 py-2 text-sm">{item}</div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Approved Recommendations</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.recommendations.length ? data.recommendations.map((item) => (
                <div key={item.id} className="rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="font-semibold">{item.title}</h2>
                    <Badge variant="outline">{item.priorityScore}/100</Badge>
                  </div>
                  {item.pageUrl && <div className="mt-1 text-xs text-muted-foreground break-all">{item.pageUrl}</div>}
                  <p className="mt-3 text-sm text-foreground">{item.recommendation}</p>
                  {(item.aiVisibilityImpact || item.businessImpact) && (
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      {item.aiVisibilityImpact && <div className="rounded-md bg-muted p-3">{item.aiVisibilityImpact}</div>}
                      {item.businessImpact && <div className="rounded-md bg-muted p-3">{item.businessImpact}</div>}
                    </div>
                  )}
                </div>
              )) : (
                <div className="py-8 text-center text-sm text-muted-foreground">No approved recommendations yet.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">30-Day Plan</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {data.actionPlan.map((week) => (
                <div key={week.week} className="rounded-md border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold">{week.week}</h2>
                    <Badge variant="secondary">{readableKey(week.focus)}</Badge>
                  </div>
                  <div className="mt-3 space-y-3">
                    {week.tasks.map((task) => (
                      <div key={`${week.week}-${task.task}`} className="text-sm">
                        <div className="font-medium">{task.task}</div>
                        <div className="mt-1 text-muted-foreground">{task.why}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-semibold">{data.latestReport?.title ?? "Report not generated yet"}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {data.latestReport ? `Generated ${format(new Date(data.latestReport.createdAt), "MMM d, yyyy")}` : "Generate a GEO/AEO Markdown report after approvals."}
                  </div>
                </div>
              </div>
              {data.latestReport?.downloadUrl && (
                <a href={data.latestReport.downloadUrl}>
                  <Button variant="outline" className="w-full gap-1.5 sm:w-auto">
                    <Download className="h-4 w-4" />Markdown
                  </Button>
                </a>
              )}
            </CardContent>
          </Card>

          {data.disclaimer && (
            <p className="text-xs leading-5 text-muted-foreground">{data.disclaimer}</p>
          )}
        </>
      )}
    </div>
  );
}
