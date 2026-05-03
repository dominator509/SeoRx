import { useState } from "react";
import { Link } from "wouter";
import {
  useListReports, useCreateReport, useDeleteReport, useListAudits,
  getListReportsQueryKey, getListAuditsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, ArrowRight, Trash2, Download } from "lucide-react";
import { format } from "date-fns";

const createSchema = z.object({ auditId: z.string().min(1, "Select an audit"), title: z.string().min(3, "Title required"), format: z.enum(["pdf", "html", "csv"]), });

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ready: "bg-emerald-100 text-emerald-700 border-emerald-200",
    generating: "bg-blue-100 text-blue-700 border-blue-200 animate-pulse",
    failed: "bg-red-100 text-red-700 border-red-200",
  };
  return <Badge variant="outline" className={`text-[10px] font-semibold ${map[status] ?? ""}`}>{status}</Badge>;
}

export default function Reports() {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: reports, isLoading } = useListReports({}, { query: { queryKey: getListReportsQueryKey() } });
  const { data: auditsData } = useListAudits({ status: "completed" } as any, { query: { queryKey: getListAuditsQueryKey({ status: "completed" }) } });
  const completedAudits = (auditsData as any)?.items ?? auditsData ?? [];

  const createReport = useCreateReport({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListReportsQueryKey() }); setCreateOpen(false); form.reset(); toast({ title: "Report generating", description: "Your report will be ready shortly." }); },
      onError: () => toast({ title: "Error", description: "Failed to create report.", variant: "destructive" }),
    },
  });
  const deleteReport = useDeleteReport({
    mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListReportsQueryKey() }); setDeleteId(null); toast({ title: "Deleted", description: "Report removed." }); } },
  });

  const form = useForm<z.infer<typeof createSchema>>({ resolver: zodResolver(createSchema), defaultValues: { auditId: "", title: "", format: "pdf" } });

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{(reports as any[])?.length ?? 0} reports</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 w-full sm:w-auto" data-testid="generate-report-button">
              <Plus className="w-4 h-4" />Generate Report
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Generate Report</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => createReport.mutate({ data: v as any }))} className="space-y-4">
                <FormField control={form.control} name="auditId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Audit</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-audit"><SelectValue placeholder="Select audit" /></SelectTrigger></FormControl>
                      <SelectContent>{completedAudits.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.clientName} — {a.url}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Report Title</FormLabel>
                    <FormControl><Input placeholder="Q2 SEO Audit Report" {...field} data-testid="input-report-title" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="format" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Format</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="html">HTML</SelectItem>
                        <SelectItem value="csv">CSV</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createReport.isPending} data-testid="submit-report">{createReport.isPending ? "Generating..." : "Generate Report"}</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : !(reports as any[])?.length ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground text-sm">No reports yet. <button onClick={() => setCreateOpen(true)} className="text-primary underline">Generate your first</button></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {(reports as any[]).map((report: any) => (
            <Link key={report.id} href={`/reports/${report.id}`} className="block" data-testid={`report-row-${report.id}`}>
              <Card className="hover:border-primary/30 transition-colors group">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">{report.title}</span>
                      {statusBadge(report.status)}
                      <Badge variant="outline" className="text-[10px] uppercase">{report.format}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {report.clientName} · Created {format(new Date(report.createdAt), "MMM d, yyyy")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:flex-shrink-0">
                    {report.status === "ready" && report.downloadUrl && (
                      <a href={report.downloadUrl} className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" onClick={(e) => e.stopPropagation()} data-testid={`download-report-${report.id}`}>
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                    <button className="p-2 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors sm:opacity-0 sm:group-hover:opacity-100" onClick={(e) => { e.preventDefault(); setDeleteId(report.id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ArrowRight className="hidden sm:block w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Report</AlertDialogTitle><AlertDialogDescription>This will permanently delete this report.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteId && deleteReport.mutate({ id: deleteId })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
