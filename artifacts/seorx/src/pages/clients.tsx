import { useState } from "react";
import { Link } from "wouter";
import {
  useListClients,
  useCreateClient,
  useDeleteClient,
  getListClientsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/react";
import { Plus, Search, Globe, ArrowRight, Trash2, ExternalLink } from "lucide-react";
import { format } from "date-fns";

const createSchema = z.object({
  orgId: z.string().optional(),
  name: z.string().min(2, "Name required"),
  domain: z.string().min(3, "Domain required").regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Enter a valid domain"),
  industry: z.string().optional(),
  contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
});

function seoScoreBadge(score?: number | null) {
  if (score == null) return <span className="text-xs text-muted-foreground">No score</span>;
  const cls = score >= 70 ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : score >= 40 ? "bg-amber-100 text-amber-700 border-amber-200"
    : "bg-red-100 text-red-700 border-red-200";
  return <Badge variant="outline" className={`text-xs font-bold ${cls}`}>{score}</Badge>;
}

export default function Clients() {
  const { user } = useUser();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: clients, isLoading } = useListClients(
    { search: search || undefined },
    { query: { queryKey: getListClientsQueryKey({ search: search || undefined }) } },
  );

  const createClient = useCreateClient({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
        setCreateOpen(false);
        form.reset();
        toast({ title: "Client added", description: "Client has been created." });
      },
      onError: () => toast({ title: "Error", description: "Failed to add client.", variant: "destructive" }),
    },
  });

  const deleteClient = useDeleteClient({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
        setDeleteId(null);
        toast({ title: "Deleted", description: "Client removed." });
      },
    },
  });

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { orgId: "", name: "", domain: "", industry: "", contactEmail: "" },
  });

  const activeOrgId = user?.unsafeMetadata?.orgId as string | undefined;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{clients?.length ?? 0} clients across all organizations</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 w-full sm:w-auto" data-testid="add-client-button">
              <Plus className="w-4 h-4" />Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Add Client</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => createClient.mutate({ data: { ...v, orgId: activeOrgId ?? v.orgId } as any }))} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Client Name</FormLabel><FormControl><Input placeholder="Acme Corp" {...field} data-testid="input-client-name" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="domain" render={({ field }) => (
                  <FormItem><FormLabel>Domain</FormLabel><FormControl><Input placeholder="acmecorp.com" {...field} data-testid="input-client-domain" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="industry" render={({ field }) => (
                  <FormItem><FormLabel>Industry (optional)</FormLabel><FormControl><Input placeholder="Technology" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="contactEmail" render={({ field }) => (
                  <FormItem><FormLabel>Contact Email (optional)</FormLabel><FormControl><Input placeholder="seo@acmecorp.com" type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createClient.isPending} data-testid="submit-create-client">
                  {createClient.isPending ? "Adding..." : "Add Client"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="search-clients"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : !clients?.length ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground text-sm">
          No clients found. <button onClick={() => setCreateOpen(true)} className="text-primary underline">Add your first client</button>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {clients.map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`} className="block" data-testid={`client-row-${client.id}`}>
              <Card className="hover:border-primary/30 transition-colors group">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Globe className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{client.name}</span>
                      {client.industry && <Badge variant="secondary" className="text-xs">{client.industry}</Badge>}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <ExternalLink className="w-3 h-3" />
                      {client.domain}
                      {client.lastAuditAt && <span className="sm:ml-2">Last audit: {format(new Date(client.lastAuditAt), "MMM d, yyyy")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap sm:flex-shrink-0">
                    <div className="text-xs text-muted-foreground">{client.auditCount ?? 0} audits</div>
                    <div className="text-xs text-muted-foreground">{client.issueCount ?? 0} issues</div>
                    {seoScoreBadge(client.seoScore)}
                    <button className="p-2 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors sm:opacity-0 sm:group-hover:opacity-100" onClick={(e) => { e.preventDefault(); setDeleteId(client.id); }} data-testid={`delete-client-${client.id}`}>
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
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the client and all associated data. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteId && deleteClient.mutate({ id: deleteId })} data-testid="confirm-delete-client">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
