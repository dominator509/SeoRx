import { Link } from "wouter";
import { Activity, Zap, Shield, BarChart3, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Zap, title: "AI-Powered Analysis", desc: "Get prioritized fix recommendations from LLMs — not just raw data dumps." },
  { icon: Shield, title: "Human Approval Gate", desc: "Every AI recommendation goes through your review before reaching clients." },
  { icon: BarChart3, title: "Score Trends", desc: "Track SEO health over time with audit history and visual trends." },
  { icon: CheckCircle, title: "Multi-Client Dashboard", desc: "Manage all your agency clients in one unified command center." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 h-14 flex items-center gap-3">
        <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
          <Activity className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <span className="font-bold text-foreground tracking-tight">SEORx</span>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" size="sm" data-testid="sign-in-link">Sign in</Button>
          </Link>
          <Link href="/sign-up">
            <Button size="sm" data-testid="get-started-link">Get started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-8 border border-primary/20">
          <Zap className="w-3.5 h-3.5" />
          AI-Powered SEO Audit Platform
        </div>
        <h1 className="text-5xl font-bold text-foreground tracking-tight max-w-3xl leading-tight mb-6">
          Find the leaks. Rank the fixes.<br />
          <span className="text-primary">Win the client.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mb-10 leading-relaxed">
          SEORx is the SEO command center for digital agencies. Crawl, diagnose, prioritize, and report — all with AI-powered recommendations that you approve before clients ever see them.
        </p>
        <div className="flex items-center gap-4">
          <Link href="/sign-up">
            <Button size="lg" className="gap-2" data-testid="hero-cta">
              Start your first audit <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button variant="outline" size="lg" data-testid="hero-sign-in">Sign in</Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-muted/30 px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground text-center mb-12">Built for serious SEO teams</h2>
          <div className="grid grid-cols-2 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-background border border-border rounded-lg p-5">
                <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
        SEORx &copy; {new Date().getFullYear()} &mdash; AI-powered SEO diagnostics for digital agencies
      </footer>
    </div>
  );
}
