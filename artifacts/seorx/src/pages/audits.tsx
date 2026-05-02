import { useState } from "react";
import { Link } from "wouter";
import { useListAudits, useDeleteAudit, getListAuditsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, ArrowRight, Trash2, Globe, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

function auditStatusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    completed: { label: "Completed", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    running: { label: "Running", cls: "bg-blue-100 text-blue-700 border-blue-200 animate-pulse" },
    pending: { label: "Pending", cls: "bg-gray-100 text-gray-600 border-gray-200" },
    failed: { label: "Failed", cls: "bg-red-100 text-red-700 border-red-200" },
  };
  const s = map[status] ?? map.pending;
  return <Badge variant="outline" className={`text-[10px] font-semibold ${s.cls}`}>{s.label}</Badge>;
}

function SeverityPill({ count, color }: { count?: number | null; color: string }) {
  if (!count) return null;
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${color}`}>{count}</span>;
}

export default function Audits() {
  const [status, setStatus] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const params = status !== "all" ? { status } : {};
  const { data, isLoading } = useListAudits(params as any, {
    query: { queryKey: getListAuditsQueryKey(params as any) },
  });

  const deleteAudit = useDeleteAudit({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAuditsQueryKey() });
        setDeleteId(null);
        toast({ title: "Deleted", description: "Audit removed." });
      },
    },
  });

  const audits = (data as any)?.items ?? data ?? [];
  const total = (data as any)?.total ?? audits.length;

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audits</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} audit jobs</p>
        </div>
        <Link href="/audits/new">
          <Button size="sm" className="gap-1.5" data-testid="new-audit-button">
            <Plus className="w-4 h-4" />New Audit
          </Button>
        </Link>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" data-testid="filter-status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : !audits.length ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground text-sm">
          No audits found. <Link href="/audits/new" className="text-primary underline">Run your first audit</Link>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {audits.map((audit: any) => (
            <Link key={audit.id} href={`/audits/${audit.id}`} className="block" data-testid={`audit-row-${audit.id}`}>
              <Card className="hover:border-primary/30 transition-colors group">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Globe className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">{audit.clientName}</span>
                      {auditStatusBadge(audit.status)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{audit.url}</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Severity pills */}
                    <div className="flex gap-1">
                      <SeverityPill count={audit.criticalCount} color="bg-red-100 text-red-700" />
                      <SeverityPill count={audit.highCount} color="bg-orange-100 text-orange-700" />
                      <SeverityPill count={audit.mediumCount} color="bg-yellow-100 text-yellow-700" />
                      <SeverityPill count={audit.lowCount} color="bg-blue-100 text-blue-700" />
                    </div>
                    {audit.seoScore != null && (
                      <span className={`text-sm font-bold tabular-nums ${audit.seoScore >= 70 ? "text-emerald-600" : audit.seoScore >= 40 ? "text-amber-500" : "text-red-500"}`}>
                        {audit.seoScore}
                      </span>
                    )}
                    {audit.completedAt && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(audit.completedAt), { addSuffix: true })}
                      </div>
                    )}
                    <button
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                      onClick={(e) => { e.preventDefault(); setDeleteId(audit.id); }}
                      data-testid={`delete-audit-${audit.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Audit</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this audit and all its issues. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteId && deleteAudit.mutate({ id: deleteId })} data-testid="confirm-delete-audit">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
