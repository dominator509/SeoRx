import { useState } from "react";
import {
  useListOrganizations, useCreateOrganization, useDeleteOrganization,
  getListOrganizationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Building2, Users, Search, Trash2 } from "lucide-react";

const schema = z.object({
  name: z.string().min(2, "Name required"),
  slug: z.string().min(2, "Slug required").regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
});

const planBadge: Record<string, string> = {
  free: "bg-gray-100 text-gray-600",
  starter: "bg-blue-100 text-blue-700",
  professional: "bg-primary/10 text-primary",
  enterprise: "bg-purple-100 text-purple-700",
};

export default function Organizations() {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: orgs, isLoading } = useListOrganizations({ query: { queryKey: getListOrganizationsQueryKey() } });
  const createOrg = useCreateOrganization({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
        setCreateOpen(false);
        form.reset();
        toast({ title: "Organization created" });
      },
      onError: () => toast({ title: "Error", description: "Failed to create organization.", variant: "destructive" }),
    },
  });
  const deleteOrg = useDeleteOrganization({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
        setDeleteId(null);
        toast({ title: "Deleted" });
      },
    },
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", slug: "" },
  });

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{(orgs as any[])?.length ?? 0} organizations</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5" data-testid="add-org-button">
              <Plus className="w-4 h-4" />New Organization
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Create Organization</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => createOrg.mutate({ data: v as any }))} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Apex Digital" {...field} data-testid="input-org-name" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="slug" render={({ field }) => (
                  <FormItem><FormLabel>Slug</FormLabel><FormControl><Input placeholder="apex-digital" {...field} data-testid="input-org-slug" /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createOrg.isPending} data-testid="submit-org">
                  {createOrg.isPending ? "Creating..." : "Create Organization"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : !(orgs as any[])?.length ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground text-sm">No organizations yet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {(orgs as any[]).map((org: any) => (
            <Card key={org.id} data-testid={`org-card-${org.id}`}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{org.name}</span>
                    <Badge variant="secondary" className={`text-[10px] capitalize ${planBadge[org.plan ?? "free"] ?? ""}`}>{org.plan ?? "free"}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{org.memberCount ?? 0} members</span>
                    <span className="flex items-center gap-1"><Search className="w-3 h-3" />{org.clientCount ?? 0} clients</span>
                    <span className="font-mono text-[10px]">{org.slug}</span>
                  </div>
                </div>
                <button
                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  onClick={() => setDeleteId(org.id)}
                  data-testid={`delete-org-${org.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Organization</AlertDialogTitle><AlertDialogDescription>This will permanently delete the organization.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteId && deleteOrg.mutate({ id: deleteId })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
