import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateOrganization, useCreateClient, useCreateAudit, getListOrganizationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Activity, Building2, Users, Search, CheckCircle, ArrowRight } from "lucide-react";

const orgSchema = z.object({
  name: z.string().min(2, "Organization name required"),
  slug: z.string().min(2, "Slug required").regex(/^[a-z0-9-]+$/, "Lowercase, numbers, hyphens only"),
});

const clientSchema = z.object({
  name: z.string().min(2, "Client name required"),
  domain: z.string().min(3, "Domain required"),
});

const auditSchema = z.object({
  url: z.string().url("Enter a valid URL including https://"),
});

const steps = [
  { label: "Create Organization", icon: Building2 },
  { label: "Add First Client", icon: Users },
  { label: "Run First Audit", icon: Search },
  { label: "Done!", icon: CheckCircle },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState<string | null>(null);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const orgForm = useForm<z.infer<typeof orgSchema>>({ resolver: zodResolver(orgSchema), defaultValues: { name: "", slug: "" } });
  const clientForm = useForm<z.infer<typeof clientSchema>>({ resolver: zodResolver(clientSchema), defaultValues: { name: "", domain: "" } });
  const auditForm = useForm<z.infer<typeof auditSchema>>({ resolver: zodResolver(auditSchema), defaultValues: { url: "" } });

  const createOrg = useCreateOrganization({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
        setStep(1);
      },
      onError: () => toast({ title: "Error", description: "Failed to create organization.", variant: "destructive" }),
    },
  });
  const createClient = useCreateClient({
    mutation: {
      onSuccess: (client) => { setClientId(client.id); setStep(2); },
      onError: () => toast({ title: "Error", description: "Failed to add client.", variant: "destructive" }),
    },
  });
  const createAudit = useCreateAudit({
    mutation: {
      onSuccess: (audit) => { setAuditId(audit.id); setStep(3); },
      onError: () => toast({ title: "Error", description: "Failed to start audit.", variant: "destructive" }),
    },
  });

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold text-foreground">SEORx</span>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i < step ? "bg-primary text-primary-foreground"
                  : i === step ? "bg-primary/20 text-primary ring-2 ring-primary"
                  : "bg-muted text-muted-foreground"
                }`}>
                  {i < step ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                {i < steps.length - 1 && <div className={`h-0.5 w-8 ${i < step ? "bg-primary" : "bg-muted"}`} />}
              </div>
            );
          })}
        </div>

        {step === 0 && (
          <Card>
            <CardHeader><CardTitle>Create your organization</CardTitle></CardHeader>
            <CardContent>
              <Form {...orgForm}>
                <form onSubmit={orgForm.handleSubmit((v) => createOrg.mutate({ data: v }))} className="space-y-4">
                  <FormField control={orgForm.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Organization Name</FormLabel><FormControl><Input placeholder="Apex Digital Agency" {...field} data-testid="input-org-name" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={orgForm.control} name="slug" render={({ field }) => (
                    <FormItem><FormLabel>URL Slug</FormLabel><FormControl><Input placeholder="apex-digital" {...field} data-testid="input-org-slug" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <Button type="submit" className="w-full gap-2" disabled={createOrg.isPending} data-testid="next-org">
                    {createOrg.isPending ? "Creating..." : "Continue"}<ArrowRight className="w-4 h-4" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>Add your first client</CardTitle></CardHeader>
            <CardContent>
              <Form {...clientForm}>
                <form
                  onSubmit={clientForm.handleSubmit((v) => createClient.mutate({ data: v }))}
                  className="space-y-4"
                >
                  <FormField control={clientForm.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Client Name</FormLabel><FormControl><Input placeholder="Acme Corp" {...field} data-testid="input-client-name" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={clientForm.control} name="domain" render={({ field }) => (
                    <FormItem><FormLabel>Domain</FormLabel><FormControl><Input placeholder="acmecorp.com" {...field} data-testid="input-client-domain" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <Button type="submit" className="w-full gap-2" disabled={createClient.isPending} data-testid="next-client">
                    {createClient.isPending ? "Adding..." : "Continue"}<ArrowRight className="w-4 h-4" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>Run your first audit</CardTitle></CardHeader>
            <CardContent>
              <Form {...auditForm}>
                <form onSubmit={auditForm.handleSubmit((v) => createAudit.mutate({ data: { clientId: clientId!, url: v.url, maxPages: 50, includePageSpeed: false } }))} className="space-y-4">
                  <FormField control={auditForm.control} name="url" render={({ field }) => (
                    <FormItem><FormLabel>Website URL</FormLabel><FormControl><Input placeholder="https://acmecorp.com" {...field} data-testid="input-audit-url" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <Button type="submit" className="w-full gap-2" disabled={createAudit.isPending} data-testid="start-audit">
                    <Search className="w-4 h-4" />{createAudit.isPending ? "Starting..." : "Start Audit"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">You're all set!</h2>
              <p className="text-sm text-muted-foreground mb-6">Your first audit is running. Head to your dashboard to see results as they come in.</p>
              <Button className="gap-2" onClick={() => auditId ? setLocation(`/audits/${auditId}`) : setLocation("/dashboard")} data-testid="go-to-dashboard">
                <ArrowRight className="w-4 h-4" />Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
