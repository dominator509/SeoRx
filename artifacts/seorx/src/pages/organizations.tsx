import { useState } from "react";
import {
  useListOrganizations, useCreateOrganization, useDeleteOrganization,
  useListOrgMembers, useInviteOrgMember,
  getListOrganizationsQueryKey, getListOrgMembersQueryKey,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const memberSchema = z.object({
  email: z.string().email("Enter a valid email"),
  role: z.enum(["viewer", "agency", "client", "admin"]),
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
  const [memberOrgId, setMemberOrgId] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: orgs, isLoading } = useListOrganizations({ query: { queryKey: getListOrganizationsQueryKey() } });
  const selectedOrg = (orgs as any[] | undefined)?.find((org) => org.id === memberOrgId);
  const { data: members, isLoading: membersLoading } = useListOrgMembers(memberOrgId ?? "", {
    query: {
      enabled: !!memberOrgId,
      queryKey: memberOrgId ? getListOrgMembersQueryKey(memberOrgId) : ["org-members", "disabled"],
    },
  });
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
  const inviteMember = useInviteOrgMember({
    mutation: {
      onSuccess: () => {
        if (memberOrgId) {
          qc.invalidateQueries({ queryKey: getListOrgMembersQueryKey(memberOrgId) });
        }
        qc.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
        memberForm.reset({ email: "", role: "viewer" });
        toast({ title: "Member invited" });
      },
      onError: () => toast({ title: "Error", description: "Failed to invite member.", variant: "destructive" }),
    },
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", slug: "" },
  });
  const memberForm = useForm<z.infer<typeof memberSchema>>({
    resolver: zodResolver(memberSchema),
    defaultValues: { email: "", role: "viewer" },
  });

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{(orgs as any[])?.length ?? 0} organizations</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 w-full sm:w-auto" data-testid="add-org-button">
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
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{org.name}</span>
                    <Badge variant="secondary" className={`text-[10px] capitalize ${planBadge[org.plan ?? "free"] ?? ""}`}>{org.plan ?? "free"}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{org.memberCount ?? 0} members</span>
                    <span className="flex items-center gap-1"><Search className="w-3 h-3" />{org.clientCount ?? 0} clients</span>
                    <span className="font-mono text-[10px]">{org.slug}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setMemberOrgId(org.id)}
                    data-testid={`manage-members-${org.id}`}
                  >
                    <Users className="w-4 h-4" />Members
                  </Button>
                  <button
                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => setDeleteId(org.id)}
                    data-testid={`delete-org-${org.id}`}
                    aria-label={`Delete ${org.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!memberOrgId} onOpenChange={(open) => !open && setMemberOrgId(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{selectedOrg ? `${selectedOrg.name} Members` : "Organization Members"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border divide-y" data-testid="org-members-list">
              {membersLoading ? (
                <div className="p-3 text-sm text-muted-foreground">Loading members...</div>
              ) : !(members as any[] | undefined)?.length ? (
                <div className="p-3 text-sm text-muted-foreground">No members yet.</div>
              ) : (
                (members as any[]).map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-3 p-3 text-sm" data-testid={`org-member-${member.id}`}>
                    <span className="truncate">{member.email}</span>
                    <Badge variant="secondary" className="capitalize">{member.role}</Badge>
                  </div>
                ))
              )}
            </div>
            <Form {...memberForm}>
              <form
                onSubmit={memberForm.handleSubmit((values) => {
                  if (!memberOrgId) return;
                  inviteMember.mutate({ orgId: memberOrgId, data: values });
                })}
                className="grid gap-3 sm:grid-cols-[1fr_8rem_auto]"
              >
                <FormField control={memberForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" placeholder="teammate@example.com" {...field} data-testid="input-member-email" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={memberForm.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-member-role"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="agency">Agency</SelectItem>
                        <SelectItem value="client">Client</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex items-end">
                  <Button type="submit" className="w-full" disabled={inviteMember.isPending} data-testid="submit-member-invite">
                    {inviteMember.isPending ? "Inviting..." : "Invite"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

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
