import { useState } from "react";
import {
  useListAiProviders, useCreateAiProvider, useUpdateAiProvider, useDeleteAiProvider,
  getListAiProvidersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/react";
import { Plus, Cpu, Trash2, CheckCircle } from "lucide-react";

const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307", "claude-3-opus-20240229"],
  gemini: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
  ollama: ["llama3.2", "llama3.1", "mistral", "codellama"],
  custom: [],
};

const createSchema = z.object({
  orgId: z.string().min(1),
  name: z.string().min(2, "Name required"),
  provider: z.enum(["openai", "anthropic", "gemini", "ollama", "custom"]),
  model: z.string().min(1, "Model required"),
  apiKey: z.string().optional(),
  baseUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  isDefault: z.boolean(),
});

export default function AiProviders() {
  const { user } = useUser();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: providers, isLoading } = useListAiProviders({ query: { queryKey: getListAiProvidersQueryKey() } });

  const createProvider = useCreateAiProvider({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAiProvidersQueryKey() });
        setCreateOpen(false);
        form.reset();
        toast({ title: "AI Provider added" });
      },
      onError: () => toast({ title: "Error", description: "Failed to add provider.", variant: "destructive" }),
    },
  });
  const deleteProvider = useDeleteAiProvider({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAiProvidersQueryKey() });
        setDeleteId(null);
        toast({ title: "Deleted" });
      },
    },
  });

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { orgId: "", name: "", provider: "openai", model: "gpt-4o", apiKey: "", baseUrl: "", isDefault: false },
  });
  const activeOrgId = user?.unsafeMetadata?.orgId as string | undefined;

  const selectedProvider = form.watch("provider");
  const models = PROVIDER_MODELS[selectedProvider] ?? [];

  const providerBadgeColor: Record<string, string> = {
    openai: "bg-emerald-100 text-emerald-700 border-emerald-200",
    anthropic: "bg-orange-100 text-orange-700 border-orange-200",
    gemini: "bg-blue-100 text-blue-700 border-blue-200",
    ollama: "bg-purple-100 text-purple-700 border-purple-200",
    custom: "bg-gray-100 text-gray-700 border-gray-200",
  };

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Providers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure LLM providers for AI-powered recommendations</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5" data-testid="add-provider-button">
              <Plus className="w-4 h-4" />Add Provider
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Add AI Provider</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => createProvider.mutate({ data: { ...v, orgId: activeOrgId ?? v.orgId } as any }))} className="space-y-4">
                {!activeOrgId && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    No active organization is selected.
                  </div>
                )}
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Display Name</FormLabel><FormControl><Input placeholder="My OpenAI Provider" {...field} data-testid="input-provider-name" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="provider" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider</FormLabel>
                    <Select onValueChange={(v) => { field.onChange(v); form.setValue("model", PROVIDER_MODELS[v]?.[0] ?? ""); }} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-provider"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="gemini">Google Gemini</SelectItem>
                        <SelectItem value="ollama">Ollama (Local)</SelectItem>
                        <SelectItem value="custom">Custom / OpenAI-compatible</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="model" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    {models.length > 0 ? (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <FormControl><Input placeholder="model-name" {...field} /></FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="apiKey" render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key {selectedProvider === "ollama" ? "(optional)" : ""}</FormLabel>
                    <FormControl><Input type="password" placeholder="sk-..." {...field} data-testid="input-api-key" /></FormControl>
                    <FormDescription className="text-xs">Stored encrypted. Never exposed in API responses.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                {(selectedProvider === "ollama" || selectedProvider === "custom") && (
                  <FormField control={form.control} name="baseUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base URL</FormLabel>
                      <FormControl><Input placeholder="http://localhost:11434" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
                <FormField control={form.control} name="isDefault" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div><FormLabel className="text-sm">Set as default provider</FormLabel></div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createProvider.isPending} data-testid="submit-provider">
                  {createProvider.isPending ? "Adding..." : "Add Provider"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : !(providers as any[])?.length ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground text-sm">
          No AI providers configured. <button onClick={() => setCreateOpen(true)} className="text-primary underline">Add one</button>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {(providers as any[]).map((p: any) => (
            <Card key={p.id} data-testid={`provider-card-${p.id}`}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Cpu className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{p.name}</span>
                    <Badge variant="outline" className={`text-[10px] font-semibold capitalize ${providerBadgeColor[p.provider] ?? ""}`}>{p.provider}</Badge>
                    {p.isDefault && (
                      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 gap-1">
                        <CheckCircle className="w-2.5 h-2.5" />Default
                      </Badge>
                    )}
                    {!p.isActive && <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactive</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {p.model}
                    {p.baseUrl && <span className="ml-2">· {p.baseUrl}</span>}
                  </div>
                </div>
                <button
                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  onClick={() => setDeleteId(p.id)}
                  data-testid={`delete-provider-${p.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-dashed border-border bg-muted/20">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-2">How AI Recommendations Work</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            When an audit completes, SEORx uses the active AI provider to generate fix recommendations for each issue. All AI-generated content requires human approval before it is shown to clients. Configure your preferred LLM provider above — you can use OpenAI, Anthropic, Google Gemini, a local Ollama instance, or any OpenAI-compatible endpoint.
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Provider</AlertDialogTitle><AlertDialogDescription>Remove this AI provider configuration.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteId && deleteProvider.mutate({ id: deleteId })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
