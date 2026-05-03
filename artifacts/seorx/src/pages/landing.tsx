import { Link } from "wouter";
import { Menu, Activity, Zap, Shield, BarChart3, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const features = [
  { icon: Zap, title: "AI-Powered Analysis", desc: "Get prioritized fix recommendations from LLMs — not just raw data dumps." },
  { icon: Shield, title: "Human Approval Gate", desc: "Every AI recommendation goes through your review before reaching clients." },
  { icon: BarChart3, title: "Score Trends", desc: "Track SEO health over time with audit history and visual trends." },
  { icon: CheckCircle, title: "Multi-Client Dashboard", desc: "Manage all your agency clients in one unified command center." },
];

const navLinks = [
  { href: "/sign-in", label: "Sign in" },
  { href: "/sign-up", label: "Get started" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-4 sm:px-6 h-16 flex items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
          <Activity className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <span className="font-bold text-foreground tracking-tight text-base sm:text-lg">SEORx</span>
        <div className="ml-auto hidden sm:flex items-center gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" size="default" data-testid="sign-in-link">Sign in</Button>
          </Link>
          <Link href="/sign-up">
            <Button size="default" data-testid="get-started-link">Get started</Button>
          </Link>
        </div>
        <div className="ml-auto sm:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open menu">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-sm p-5">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
                  <Activity className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
                </div>
                <span className="font-bold text-foreground tracking-tight">SEORx</span>
              </div>
              <div className="flex flex-col gap-3">
                {navLinks.map(({ href, label }) => (
                  <Link key={href} href={href}>
                    <Button className="w-full justify-start" size="lg" variant={label === "Sign in" ? "outline" : "default"}>
                      {label}
                    </Button>
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 sm:px-6 py-14 sm:py-24">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-full mb-6 sm:mb-8 border border-primary/20 max-w-full">
          <Zap className="w-3.5 h-3.5" />
          <span className="truncate">AI-Powered SEO Audit Platform</span>
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground tracking-tight max-w-4xl leading-tight mb-5 sm:mb-6">
          Find the leaks. Rank the fixes.<br />
          <span className="text-primary">Win the client.</span>
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mb-8 sm:mb-10 leading-relaxed">
          SEORx is the SEO command center for digital agencies. Crawl, diagnose, prioritize, and report — all with AI-powered recommendations that you approve before clients ever see them.
        </p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto max-w-sm sm:max-w-none">
          <Link href="/sign-up" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto sm:px-8 gap-2" data-testid="hero-cta">
              Start your first audit <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/sign-in" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="w-full sm:w-auto sm:px-8" data-testid="hero-sign-in">Sign in</Button>
          </Link>
        </div>
      </section>

      <section className="border-t border-border bg-muted/30 px-4 sm:px-6 py-14 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8 sm:mb-12">Built for serious SEO teams</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-background border border-border rounded-xl p-5 sm:p-6">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2 text-base sm:text-lg">{title}</h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-4 sm:px-6 py-6 text-center text-xs sm:text-sm text-muted-foreground">
        SEORx &copy; {new Date().getFullYear()} &mdash; AI-powered SEO diagnostics for digital agencies
      </footer>
    </div>
  );
}
