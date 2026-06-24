import { lazy, Suspense, useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import AppLayout from "@/components/layout/app-layout";

const NotFound = lazy(() => import("@/pages/not-found"));
const Landing = lazy(() => import("@/pages/landing"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Clients = lazy(() => import("@/pages/clients"));
const ClientDetail = lazy(() => import("@/pages/client-detail"));
const ClientAiVisibility = lazy(() => import("@/pages/client-ai-visibility"));
const Audits = lazy(() => import("@/pages/audits"));
const AuditNew = lazy(() => import("@/pages/audit-new"));
const AuditDetail = lazy(() => import("@/pages/audit-detail"));
const Issues = lazy(() => import("@/pages/issues"));
const Reports = lazy(() => import("@/pages/reports"));
const ReportDetail = lazy(() => import("@/pages/report-detail"));
const AiProviders = lazy(() => import("@/pages/ai-providers"));
const Organizations = lazy(() => import("@/pages/organizations"));
const Settings = lazy(() => import("@/pages/settings"));
const Onboarding = lazy(() => import("@/pages/onboarding"));

const configuredClerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkPubKey = configuredClerkPubKey
  ? publishableKeyFromHost(window.location.hostname, configuredClerkPubKey)
  : undefined;
const e2eAuthEnabled = import.meta.env.VITE_E2E_AUTH === "true";

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(160, 100%, 36%)",
    colorForeground: "hsl(0, 0%, 9%)",
    colorMutedForeground: "hsl(240, 3.8%, 46.1%)",
    colorDanger: "hsl(0, 84.2%, 60.2%)",
    colorBackground: "hsl(0, 0%, 100%)",
    colorInput: "hsl(0, 0%, 89.8%)",
    colorInputForeground: "hsl(0, 0%, 9%)",
    colorNeutral: "hsl(0, 0%, 89.8%)",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.25rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-xl w-[440px] max-w-full overflow-hidden shadow-xl border border-gray-100",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-gray-900 font-semibold",
    headerSubtitle: "text-gray-500",
    socialButtonsBlockButtonText: "text-gray-700 font-medium",
    formFieldLabel: "text-gray-700 font-medium",
    footerActionLink: "text-emerald-600 font-medium hover:text-emerald-700",
    footerActionText: "text-gray-500",
    dividerText: "text-gray-400",
    identityPreviewEditButton: "text-emerald-600",
    formFieldSuccessText: "text-emerald-600",
    alertText: "text-gray-700",
    logoBox: "mb-2",
    logoImage: "h-8 w-auto",
    socialButtonsBlockButton: "border border-gray-200 hover:bg-gray-50",
    formButtonPrimary: "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold",
    formFieldInput: "border-gray-200 bg-white text-gray-900 focus:ring-emerald-500",
    footerAction: "bg-gray-50",
    dividerLine: "bg-gray-200",
    alert: "border-gray-200 bg-gray-50",
    otpCodeFieldInput: "border-gray-200",
    formFieldRow: "",
    main: "",
  },
};

function RouteFallback() {
  return <div className="min-h-[100dvh] bg-background" aria-busy="true" />;
}

function MissingAuthConfig() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-6">
      <div className="max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">Authentication is not configured</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Set the Clerk publishable key for this environment, then rebuild the app.
        </p>
      </div>
    </main>
  );
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <SignIn routing="hash" signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <SignUp routing="hash" signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function AuthTokenSetter() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);
  return null;
}

function E2EAuthTokenSetter() {
  useEffect(() => {
    setAuthTokenGetter(() => "e2e-test-token");
    return () => setAuthTokenGetter(null);
  }, []);
  return null;
}

function SignedIn({ children }: { children: React.ReactNode }) {
  return e2eAuthEnabled ? <>{children}</> : <Show when="signed-in">{children}</Show>;
}

function SignedOut({ children }: { children: React.ReactNode }) {
  return e2eAuthEnabled ? null : <Show when="signed-out">{children}</Show>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);
  return null;
}

function HomeRedirect() {
  return (
    <>
      <SignedIn>
        <Redirect to="/dashboard" />
      </SignedIn>
      <SignedOut>
        <Landing />
      </SignedOut>
    </>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <SignedIn>
        {e2eAuthEnabled ? <E2EAuthTokenSetter /> : <AuthTokenSetter />}
        <AppLayout>
          <Component />
        </AppLayout>
      </SignedIn>
      <SignedOut>
        <Redirect to="/" />
      </SignedOut>
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/onboarding">
        <SignedIn>
          {e2eAuthEnabled ? <E2EAuthTokenSetter /> : <AuthTokenSetter />}
          <Onboarding />
        </SignedIn>
        <SignedOut>
          <Redirect to="/" />
        </SignedOut>
      </Route>
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/clients"><ProtectedRoute component={Clients} /></Route>
      <Route path="/clients/:id/ai-visibility"><ProtectedRoute component={ClientAiVisibility} /></Route>
      <Route path="/clients/:id"><ProtectedRoute component={ClientDetail} /></Route>
      <Route path="/audits"><ProtectedRoute component={Audits} /></Route>
      <Route path="/audits/new"><ProtectedRoute component={AuditNew} /></Route>
      <Route path="/audits/:id"><ProtectedRoute component={AuditDetail} /></Route>
      <Route path="/issues"><ProtectedRoute component={Issues} /></Route>
      <Route path="/reports"><ProtectedRoute component={Reports} /></Route>
      <Route path="/reports/:id"><ProtectedRoute component={ReportDetail} /></Route>
      <Route path="/ai-providers"><ProtectedRoute component={AiProviders} /></Route>
      <Route path="/organizations"><ProtectedRoute component={Organizations} /></Route>
      <Route path="/settings"><ProtectedRoute component={Settings} /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function E2EProviderWithRoutes() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Suspense fallback={<RouteFallback />}>
          <Router />
        </Suspense>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey!}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Sign in to SEORx", subtitle: "Your SEO command center awaits" } },
        signUp: { start: { title: "Create your account", subtitle: "Start auditing and fixing SEO at scale" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Suspense fallback={<RouteFallback />}>
            <Router />
          </Suspense>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  if (e2eAuthEnabled) {
    return (
      <WouterRouter base={basePath}>
        <E2EProviderWithRoutes />
      </WouterRouter>
    );
  }

  if (!clerkPubKey) {
    return <MissingAuthConfig />;
  }

  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
