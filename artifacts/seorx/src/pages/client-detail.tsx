import { useParams, Link } from "wouter";
import {
  useGetClient, useListAudits,
  getGetClientQueryKey, getListAuditsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, Mail, Search, ArrowLeft, ArrowRight, Building2 } from "lucide-react";
import { format } from "date-fns";

function seoScoreRing(score?: number | null) {
  if (score == null) return <div className="text-muted-foreground text-sm">No score</div>;
  const color = score >= 70 ? "#00b86b" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative w-20 h-20">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="32" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle
          cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${(score / 100) * 201} 201`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

function auditStatusBadge(status: string) {
  const map: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    running: "bg-blue-100 text-blue-700 border-blue-200 animate-pulse",
    pending: "bg-gray-100 text-gray-600 border-gray-200",
    failed: "bg-red-100 text-red-700 border-red-200",
  };
  return <Badge variant="outline" className={`text-[10px] font-semibold ${map[status] ?? map.pending}`}>{status}</Badge>;
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: client, isLoading: clientLoading } = useGetClient(id!, {
    query: { enabled: !!id, queryKey: getGetClientQueryKey(id!) },
  });
  const { data: auditsData, isLoading: auditsLoading } = useListAudits(
    { clientId: id },
    { query: { enabled: !!id, queryKey: getListAuditsQueryKey({ clientId: id }) } },
  );

  const audits = (auditsData as any)?.items ?? auditsData ?? [];

  if (clientLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!client) {
    return <div className="p-6 text-muted-foreground">Client not found.</div>;
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <Link href="/clients">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 mb-1">
          <ArrowLeft className="w-4 h-4" />All Clients
        </Button>
      </Link>

      {/* Header card */}
      <Card>
        <CardContent className="p-6 flex items-start gap-6">
          <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
            <Globe className="w-7 h-7 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Globe className="w-3.5 h-3.5" />{client.domain}
              </div>
              {client.industry && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5" />{client.industry}
                </div>
              )}
              {client.contactEmail && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="w-3.5 h-3.5" />{client.contactEmail}
                </div>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 text-center">
            <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">SEO Score</div>
            {seoScoreRing(client.seoScore)}
          </div>
          <Link href={`/audits/new?clientId=${client.id}`}>
            <Button size="sm" className="gap-1.5 flex-shrink-0">
              <Search className="w-4 h-4" />New Audit
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{client.auditCount ?? 0}</div>
          <div className="text-xs text-muted-foreground mt-1">Total Audits</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-red-500">{client.issueCount ?? 0}</div>
          <div className="text-xs text-muted-foreground mt-1">Open Issues</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{client.lastAuditAt ? format(new Date(client.lastAuditAt), "MMM d") : "Never"}</div>
          <div className="text-xs text-muted-foreground mt-1">Last Audit</div>
        </CardContent></Card>
      </div>

      {/* Audit history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Audit History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {auditsLoading ? (
            <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !audits.length ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No audits yet. <Link href={`/audits/new?clientId=${client.id}`} className="text-primary underline">Run one now</Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {audits.map((audit: any) => (
                <Link
                  key={audit.id}
                  href={`/audits/${audit.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors group"
                  data-testid={`audit-row-${audit.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{audit.url}</span>
                      {auditStatusBadge(audit.status)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {audit.completedAt ? format(new Date(audit.completedAt), "MMM d, yyyy 'at' HH:mm") : "In progress"}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    {audit.issueCount != null && <span className="text-xs text-muted-foreground">{audit.issueCount} issues</span>}
                    {audit.seoScore != null && (
                      <span className={`text-sm font-bold tabular-nums ${audit.seoScore >= 70 ? "text-emerald-600" : audit.seoScore >= 40 ? "text-amber-500" : "text-red-500"}`}>
                        {audit.seoScore}
                      </span>
                    )}
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
