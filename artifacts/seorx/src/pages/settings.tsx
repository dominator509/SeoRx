import { useUser, useClerk } from "@clerk/react";
import { useGetMe, useUpdateMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { LogOut, Shield, User } from "lucide-react";

const schema = z.object({ firstName: z.string().min(1, "First name required"), lastName: z.string().optional(), });
const e2eAuthEnabled = import.meta.env.VITE_E2E_AUTH === "true";
const e2eUser = {
  firstName: "E2E",
  lastName: "Tester",
  fullName: "E2E Tester",
  emailAddresses: [{ emailAddress: "e2e@example.com" }],
};

function useSettingsUser() {
  if (e2eAuthEnabled) {
    return {
      user: e2eUser,
      signOut: () => undefined,
    };
  }

  const { user } = useUser();
  const { signOut } = useClerk();
  return { user, signOut };
}

export default function Settings() {
  const { user, signOut } = useSettingsUser();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: profile } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const updateMe = useUpdateMe({
    mutation: {
      onSuccess: (updatedProfile) => {
        qc.setQueryData(getGetMeQueryKey(), updatedProfile);
        form.reset({ firstName: updatedProfile.firstName ?? "", lastName: updatedProfile.lastName ?? "" });
        toast({ title: "Profile updated" });
      },
      onError: () => toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" }),
    },
  });

  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { firstName: "", lastName: "" }, });

  useEffect(() => { if (profile) form.reset({ firstName: profile.firstName ?? "", lastName: profile.lastName ?? "" }); }, [profile, form]);

  const displayFirstName = profile?.firstName || user?.firstName || "";
  const displayLastName = profile?.lastName || user?.lastName || "";
  const displayName = [displayFirstName, displayLastName].filter(Boolean).join(" ") || user?.fullName || user?.emailAddresses[0]?.emailAddress;
  const displayEmail = profile?.email || user?.emailAddresses[0]?.emailAddress;
  const initials = [displayFirstName[0], displayLastName[0]].filter(Boolean).join("").toUpperCase() || displayEmail?.[0]?.toUpperCase() || "U";

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account and preferences</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold flex items-center gap-2"><User className="w-4 h-4" />Profile</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar className="w-14 h-14">
              <AvatarFallback className="text-lg bg-primary text-primary-foreground font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="font-semibold text-foreground truncate" data-testid="settings-display-name">{displayName}</div>
              <div className="text-sm text-muted-foreground truncate" data-testid="settings-display-email">{displayEmail}</div>
              {profile?.role && <Badge variant="secondary" className="mt-1 text-[10px] capitalize">{profile.role}</Badge>}
            </div>
          </div>
          <Separator />
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => updateMe.mutate({ data: v as any }))} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                  <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} data-testid="input-first-name" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} data-testid="input-last-name" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <Button type="submit" size="sm" className="w-full sm:w-auto" disabled={updateMe.isPending} data-testid="save-profile">
                {updateMe.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold flex items-center gap-2"><Shield className="w-4 h-4" />Security</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-2">
            <div>
              <div className="text-sm font-medium">Password</div>
              <div className="text-xs text-muted-foreground">Change your password via Clerk account settings</div>
            </div>
          </div>
          <Separator />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-2">
            <div>
              <div className="text-sm font-medium text-destructive">Sign Out</div>
              <div className="text-xs text-muted-foreground">Sign out of your account on this device</div>
            </div>
            <Button variant="outline" size="sm" className="w-full sm:w-auto gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => signOut()} data-testid="sign-out">
              <LogOut className="w-3.5 h-3.5" />Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Current Plan</div>
              <div className="text-xs text-muted-foreground mt-0.5">Starter - 10 audits/month, 5 clients</div>
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/20">Starter</Badge>
          </div>
          <div className="mt-3">
            <Button variant="outline" size="sm" disabled className="w-full sm:w-auto">Upgrade Plan (Coming Soon)</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
