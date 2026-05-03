import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import {
  LayoutDashboard,
  Users,
  Search,
  AlertTriangle,
  FileText,
  Cpu,
  Building2,
  Settings,
  LogOut,
  ChevronRight,
  Activity,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/audits", label: "Audits", icon: Search },
  { href: "/issues", label: "Issues", icon: AlertTriangle },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/ai-providers", label: "AI Providers", icon: Cpu },
  { href: "/organizations", label: "Organizations", icon: Building2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();

  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("").toUpperCase() || user?.emailAddresses[0]?.emailAddress?.[0]?.toUpperCase() || "U";

  const nav = (
    <nav className="px-2 space-y-0.5">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = location === href || (href !== "/dashboard" && location.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-colors group min-h-11",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
            data-testid={`nav-${label.toLowerCase().replace(" ", "-")}`}
          >
            <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "opacity-100" : "opacity-70 group-hover:opacity-100")} />
            <span>{label}</span>
            {active && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
          </Link>
        );
      })}
    </nav>
  );

  const mobileMenu = (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation menu">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[88vw] max-w-sm p-0">
        <div className="h-full flex flex-col bg-sidebar">
          <div className="h-16 flex items-center gap-2.5 px-4 border-b border-sidebar-border">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
              <Activity className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-sidebar-foreground tracking-tight text-base">SEORx</span>
          </div>
          <ScrollArea className="flex-1 py-3">{nav}</ScrollArea>
          <div className="border-t border-sidebar-border p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md hover:bg-sidebar-accent transition-colors text-left min-h-12"
                  data-testid="mobile-user-menu-trigger"
                >
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-sidebar-foreground truncate">{user?.firstName || user?.emailAddresses[0]?.emailAddress}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{user?.emailAddresses[0]?.emailAddress}</div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <Settings className="w-4 h-4 mr-2" />Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive cursor-pointer"
                  onClick={() => signOut()}
                  data-testid="sign-out-button"
                >
                  <LogOut className="w-4 h-4 mr-2" />Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="flex min-h-[100dvh] bg-background lg:h-screen lg:overflow-hidden">
      <aside className="hidden lg:flex w-56 flex-shrink-0 border-r border-border bg-sidebar flex-col">
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-sidebar-border">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <Activity className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-sidebar-foreground tracking-tight text-sm">SEORx</span>
          <span className="ml-auto text-[9px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase tracking-wide">Beta</span>
        </div>
        <ScrollArea className="flex-1 py-2">{nav}</ScrollArea>
        <div className="border-t border-sidebar-border p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-sidebar-accent transition-colors text-left"
                data-testid="user-menu-trigger"
              >
                <Avatar className="w-7 h-7 flex-shrink-0">
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-sidebar-foreground truncate">{user?.firstName || user?.emailAddresses[0]?.emailAddress}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{user?.emailAddresses[0]?.emailAddress}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={() => signOut()}
                data-testid="sign-out-button"
              >
                <LogOut className="w-4 h-4 mr-2" />Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="lg:hidden sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex h-14 items-center gap-3 px-4">
            {mobileMenu}
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
                <Activity className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-foreground tracking-tight truncate">SEORx</span>
            </div>
          </div>
        </div>
        <div className="pb-6 lg:pb-0">{children}</div>
      </main>
    </div>
  );
}
