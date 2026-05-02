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

const schema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().optional(),
});

export default function Settings() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: profile } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const updateMe = useUpdateMe({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: "Profile updated" });
      },
      onError: () => toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" }),
    },
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: "", lastName: "" },
  });

  useEffect(() => {
    if (profile) {
      form.reset({ firstName: profile.firstName ?? "", lastName: profile.lastName ?? "" });
    }
  }, [profile, form]);

  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "U";

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold flex items-center gap-2"><User className="w-4 h-4" />Profile</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar className="w-14 h-14">
              <AvatarFallback className="text-lg bg-primary text-primary-foreground font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold text-foreground">{user?.fullName || user?.emailAddresses[0]?.emailAddress}</div>
              <div className="text-sm text-muted-foreground">{user?.emailAddresses[0]?.emailAddress}</div>
              {profile?.role && <Badge variant="secondary" className="mt-1 text-[10px] capitalize">{profile.role}</Badge>}
            </div>
          </div>
          <Separator />
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => updateMe.mutate({ data: v as any }))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                  <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} data-testid="input-first-name" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} data-testid="input-last-name" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <Button type="submit" size="sm" disabled={updateMe.isPending} data-testid="save-profile">
                {updateMe.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold flex items-center gap-2"><Shield className="w-4 h-4" />Security</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm font-medium">Password</div>
              <div className="text-xs text-muted-foreground">Change your password via Clerk account settings</div>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm font-medium text-destructive">Sign Out</div>
              <div className="text-xs text-muted-foreground">Sign out of your account on this device</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => signOut()}
              data-testid="sign-out"
            >
              <LogOut className="w-3.5 h-3.5" />Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Plan */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Current Plan</div>
              <div className="text-xs text-muted-foreground mt-0.5">Starter — 10 audits/month, 5 clients</div>
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/20">Starter</Badge>
          </div>
          <div className="mt-3">
            <Button variant="outline" size="sm" disabled>Upgrade Plan (Coming Soon)</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
