import { Link } from "wouter";
import {
  useGetDashboardStats,
  useGetRecentAudits,
  useGetIssueBreakdown,
  useGetScoreTrends,
  getGetDashboardStatsQueryKey,
  getGetRecentAuditsQueryKey,
  getGetIssueBreakdownQueryKey,
  getGetScoreTrendsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Users, Search, AlertTriangle, TrendingUp, CheckCircle,
  Clock, ArrowRight, Activity, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  info: "#6b7280",
};

const CATEGORY_COLORS = ["#00d880", "#0ea5e9", "#f97316", "#a855f7", "#eab308", "#ef4444", "#6b7280", "#14b8a6"];

function StatCard({ title, value, subtitle, icon: Icon, color = "text-foreground", isLoading }: {
  title: string; value?: number | string; subtitle?: string; icon: React.ElementType; color?: string; isLoading: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">{title}</p>
            {isLoading ? (
              <Skeleton className="h-7 sm:h-8 w-16 mb-1" />
            ) : (
              <p className={`text-2xl sm:text-3xl font-bold tracking-tight ${color}`} data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>{value ?? "—"}</p>
            )}
            {subtitle && <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function auditStatusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    running: { label: "Running", className: "bg-blue-100 text-blue-700 border-blue-200 animate-pulse" },
    pending: { label: "Pending", className: "bg-gray-100 text-gray-600 border-gray-200" },
    failed: { label: "Failed", className: "bg-red-100 text-red-700 border-red-200" },
  };
  const s = map[status] ?? map.pending;
  return <Badge variant="outline" className={`text-[10px] font-semibold ${s.className}`}>{s.label}</Badge>;
}

function seoScoreColor(score?: number | null) {
  if (!score) return "text-muted-foreground";
  if (score >= 70) return "text-emerald-600";
  if (score >= 40) return "text-amber-500";
  return "text-red-500";
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({ query: { queryKey: getGetDashboardStatsQueryKey() } });
  const { data: recentAudits, isLoading: auditsLoading } = useGetRecentAudits({ limit: 8 }, { query: { queryKey: getGetRecentAuditsQueryKey({ limit: 8 }) } });
  const { data: breakdown, isLoading: breakdownLoading } = useGetIssueBreakdown({ query: { queryKey: getGetIssueBreakdownQueryKey() } });
  const { data: trends, isLoading: trendsLoading } = useGetScoreTrends({ days: 30 }, { query: { queryKey: getGetScoreTrendsQueryKey({ days: 30 }) } });

  const severityPieData = (breakdown?.bySeverity ?? []).map((d) => ({ name: d.severity, value: d.count }));
  const categoryPieData = (breakdown?.byCategory ?? []).map((d) => ({ name: d.category?.replace(/_/g, " "), value: d.count }));
  const trendData = (trends ?? []).map((t) => ({ date: t.date ? format(new Date(t.date), "MMM d") : "", score: Math.round(t.avgScore ?? 0), audits: t.auditCount }));

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">SEO health overview across all clients</p>
        </div>
        <Link href="/audits/new" className="w-full sm:w-auto">
          <Button size="sm" className="gap-1.5 w-full sm:w-auto" data-testid="new-audit-button">
            <Search className="w-4 h-4" />New Audit
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Clients" value={stats?.totalClients} icon={Users} isLoading={statsLoading} />
        <StatCard title="Total Audits" value={stats?.totalAudits} icon={Search} isLoading={statsLoading} />
        <StatCard title="Critical Issues" value={stats?.criticalIssues} icon={AlertTriangle} color="text-red-500" isLoading={statsLoading} />
        <StatCard title="Avg SEO Score" value={stats?.avgSeoScore ? `${stats.avgSeoScore}` : "—"} icon={Star} color={seoScoreColor(stats?.avgSeoScore)} isLoading={statsLoading} subtitle="across all clients" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Pending Approvals" value={stats?.pendingApprovals} icon={Clock} color="text-amber-500" isLoading={statsLoading} />
        <StatCard title="Resolved Issues" value={stats?.resolvedIssues} icon={CheckCircle} color="text-emerald-600" isLoading={statsLoading} />
        <StatCard title="Audits This Month" value={stats?.auditsThisMonth} icon={Activity} isLoading={statsLoading} />
        <StatCard title="Total Issues" value={stats?.totalIssues} icon={TrendingUp} isLoading={statsLoading} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">SEO Score Trends (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : trendData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No trend data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d880" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#00d880" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))" }} />
                  <Area type="monotone" dataKey="score" stroke="#00d880" strokeWidth={2} fill="url(#scoreGrad)" name="Avg Score" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Issues by Severity</CardTitle>
          </CardHeader>
          <CardContent>
            {breakdownLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : severityPieData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No issues yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={severityPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                    {severityPieData.map((entry, i) => <Cell key={i} fill={SEVERITY_COLORS[entry.name] ?? "#6b7280"} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-semibold">Recent Audits</CardTitle>
            <Link href="/audits" className="shrink-0">
              <Button variant="ghost" size="sm" className="gap-1 text-xs h-8 px-2">
                View all <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {auditsLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !recentAudits?.length ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No audits yet. <Link href="/audits/new" className="text-primary underline">Run your first audit</Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentAudits.map((audit) => (
                <Link key={audit.id} href={`/audits/${audit.id}`} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 hover:bg-muted/50 transition-colors group" data-testid={`audit-row-${audit.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">{audit.clientName}</span>
                      {auditStatusBadge(audit.status)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{audit.url}</div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap sm:flex-shrink-0">
                    {audit.issueCount != null && <div className="text-xs text-muted-foreground">{audit.issueCount} issues</div>}
                    {audit.seoScore != null && <div className={`text-sm font-bold tabular-nums ${seoScoreColor(audit.seoScore)}`}>{audit.seoScore}</div>}
                    <ArrowRight className="hidden sm:block w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
