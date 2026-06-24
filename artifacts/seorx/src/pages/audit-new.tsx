import { useLocation, useSearch } from "wouter";
import { useCreateAudit, useListClients, getListAuditsQueryKey, getListClientsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Search } from "lucide-react";

const schema = z.object({
  clientId: z.string().min(1, "Select a client"),
  url: z.string().url("Enter a valid URL including https://"),
  auditType: z.enum(["seo", "geo_aeo", "hybrid"]),
  maxPages: z.number().int().min(1).max(1000),
  includePageSpeed: z.boolean(),
});

export default function AuditNew() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preClientId = params.get("clientId") ?? "";
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: clients } = useListClients({}, { query: { queryKey: getListClientsQueryKey() } });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { clientId: preClientId, url: "", auditType: "seo", maxPages: 100, includePageSpeed: false },
  });

  const createAudit = useCreateAudit({
    mutation: {
      onSuccess: (audit) => {
        qc.invalidateQueries({ queryKey: getListAuditsQueryKey() });
        toast({ title: "Audit started", description: "Your audit is now running." });
        setLocation(`/audits/${audit.id}`);
      },
      onError: () => toast({ title: "Error", description: "Failed to start audit.", variant: "destructive" }),
    },
  });

  return (
    <div className="p-6 max-w-xl">
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 mb-4" onClick={() => setLocation("/audits")}>
        <ArrowLeft className="w-4 h-4" />All Audits
      </Button>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Search className="w-4 h-4 text-primary" />
            </div>
            <CardTitle>New Audit</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => createAudit.mutate({ data: v as any }))} className="space-y-5">
              <FormField control={form.control} name="clientId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-client">
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(clients ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name} ({c.domain})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="url" render={({ field }) => (
                <FormItem>
                  <FormLabel>Start URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com" {...field} data-testid="input-audit-url" />
                  </FormControl>
                  <FormDescription>The URL to begin crawling from.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="auditType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Audit Mode</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-audit-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="seo">SEO audit</SelectItem>
                      <SelectItem value="geo_aeo">GEO/AEO AI visibility audit</SelectItem>
                      <SelectItem value="hybrid">Hybrid SEO + GEO/AEO audit</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>Choose GEO/AEO when the deliverable is an AI visibility report.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="maxPages" render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Pages</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={1000}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      data-testid="input-max-pages"
                    />
                  </FormControl>
                  <FormDescription>Maximum pages to crawl (1–1000).</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="includePageSpeed" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <FormLabel className="text-sm font-medium">Include PageSpeed Analysis</FormLabel>
                    <FormDescription className="text-xs mt-0.5">Run Google PageSpeed Insights alongside the audit.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="toggle-pagespeed" />
                  </FormControl>
                </FormItem>
              )} />

              <Button type="submit" className="w-full gap-2" disabled={createAudit.isPending} data-testid="submit-audit">
                <Search className="w-4 h-4" />
                {createAudit.isPending ? "Starting..." : "Start Audit"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
