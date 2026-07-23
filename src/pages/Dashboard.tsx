import { useMemo, useState, useEffect } from "react";
import {
  Calendar, CalendarX, ChevronDown, ChevronRight, AlertTriangle,
  Sparkles, FileText, Bot, CheckCircle2, ShieldAlert,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Chip } from "@/components/Chip";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";
import { AGENT_API_BASE } from "@/components/AgentSystem";
import { useAuth } from "@/contexts/AuthContext";

type ApiEntity = {
  kyc_ref: string;
  entity_name: string;
  entity_type: string | null;
  jurisdiction: string | null;
  risk_rating: "High" | "Medium" | "Low" | null;
  priority: "High" | "Medium" | "Low";
  status: string;
  due_date: string | null;
  open_exceptions_count: number;
  drgs: { name: string } | null;
};

type PendingBucket = "ops" | "client" | "fcc" | "business";

type PriorityCase = {
  priority: "High" | "Medium" | "Low";
  id: string;
  entity: string;
  due: string;
  dueToday: boolean;
  bucket: PendingBucket;
  exceptions: number;
};

function getPendingBucket(e: ApiEntity): PendingBucket {
  const n = parseInt(e.kyc_ref.replace(/\D/g, ""), 10) || 0;
  const buckets: PendingBucket[] = ["ops", "client", "fcc", "business"];
  return buckets[n % 4];
}

function toPriorityCase(e: ApiEntity): PriorityCase {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const dueDate = e.due_date ? new Date(e.due_date) : null;
  if (dueDate) dueDate.setHours(0, 0, 0, 0);
  const dueToday = dueDate ? dueDate <= today : false;
  let due: string;
  if (!dueDate) due = "—";
  else if (dueDate < today) due = "Overdue";
  else if (dueDate.getTime() === today.getTime()) due = "Today";
  else if (dueDate.getTime() === tomorrow.getTime()) due = "Tomorrow";
  else due = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return {
    priority: e.priority,
    id: e.kyc_ref,
    entity: e.entity_name,
    due,
    dueToday,
    bucket: getPendingBucket(e),
    exceptions: e.open_exceptions_count,
  };
}

type CollabType = "ai" | "document" | "action";
type CaseRef = { name: string; kyc: string };

interface ActivityItem {
  id: string;
  type: CollabType;
  title: string;
  timestamp: string;
  case: CaseRef;
  snippet?: string;
}

type ExcSeverity = "high" | "medium" | "low" | null;
type DashboardInsights = {
  frequentAgentRuns: { slug: string; name: string; runs: number }[];
  exceptionSummary: { type: string; open: number; severity: ExcSeverity; ageDays: number }[];
  recentActivity: Array<{
    id: string; type: CollabType; title: string; timestamp: string;
    kycRef: string; entityName: string; snippet: string | null;
  }>;
};

const COLLAB_META: Record<CollabType, { icon: typeof Bot; tone: string }> = {
  ai:       { icon: Bot,           tone: "bg-success-soft text-success" },
  document: { icon: FileText,      tone: "bg-warning-soft text-warning" },
  action:   { icon: CheckCircle2,  tone: "bg-secondary text-foreground" },
};

const PENDING_VIEWS: { key: PendingBucket; label: string }[] = [
  { key: "ops",      label: "Pending Ops" },
  { key: "client",   label: "Pending Client" },
  { key: "fcc",      label: "Pending FCC" },
  { key: "business", label: "Pending Business" },
];

const NAVY = "hsl(220, 56%, 22%)";

const EMPTY_INSIGHTS: DashboardInsights = {
  frequentAgentRuns: [], exceptionSummary: [], recentActivity: [],
};

function formatActivityTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(date);
}

const Dashboard = () => {
  const { user } = useAuth();
  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0]
    ?? user?.email?.split("@")[0]
    ?? "there";
  const navigate = useNavigate();

  const [apiEntities, setApiEntities] = useState<ApiEntity[]>([]);
  const [insights, setInsights] = useState<DashboardInsights>(EMPTY_INSIGHTS);
  const [insightsError, setInsightsError] = useState(false);
  const [pendingView, setPendingView] = useState<PendingBucket>("ops");
  const [selectedPeriod, setSelectedPeriod] = useState<"month" | "week">("month");

  useEffect(() => {
    Promise.all([
      apiFetch(`${AGENT_API_BASE}/api/entities`),
      apiFetch(`${AGENT_API_BASE}/api/dashboard/insights`),
    ]).then(async ([entitiesResponse, insightsResponse]) => {
      if (entitiesResponse.ok) setApiEntities(await entitiesResponse.json() as ApiEntity[]);
      if (insightsResponse.ok) {
        setInsights(await insightsResponse.json() as DashboardInsights);
        setInsightsError(false);
      } else {
        setInsightsError(true);
      }
    }).catch(() => setInsightsError(true));
  }, []);

  const priorityCases = useMemo(() => apiEntities.map(toPriorityCase), [apiEntities]);

  const kpis = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Period boundaries
    let periodStart: Date;
    let periodEnd: Date;
    if (selectedPeriod === "week") {
      const dow = today.getDay(); // 0=Sun
      const toMon = dow === 0 ? -6 : 1 - dow;
      periodStart = new Date(today); periodStart.setDate(today.getDate() + toMon);
      periodEnd = new Date(periodStart); periodEnd.setDate(periodStart.getDate() + 6); periodEnd.setHours(23, 59, 59);
    } else {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const threeOut = new Date(today); threeOut.setMonth(today.getMonth() + 3);

    const dueThisMonth = apiEntities.filter(e => {
      if (!e.due_date) return false;
      const d = new Date(e.due_date);
      return d >= periodStart && d <= periodEnd;
    }).length;

    const overdue = apiEntities.filter(e => {
      if (!e.due_date || e.status === "complete") return false;
      return new Date(e.due_date) < today;
    }).length;

    const dueNext3M = apiEntities.filter(e => {
      if (!e.due_date) return false;
      const d = new Date(e.due_date);
      return d > periodEnd && d <= threeOut;
    }).length;

    const completed  = apiEntities.filter(e => e.status === "complete").length;
    const inProgress = apiEntities.filter(e => e.status !== "complete" && e.status !== "not_started").length;
    const completionPct = dueThisMonth > 0 ? Math.round((completed / dueThisMonth) * 100) : 0;

    return { dueThisMonth, overdue, dueNext3M, completed, inProgress, completionPct };
  }, [apiEntities, selectedPeriod]);

  const visibleCases = useMemo(
    () => priorityCases.filter(c => c.bucket === pendingView),
    [priorityCases, pendingView]
  );

  const highCount = visibleCases.filter(c => c.priority === "High").length;

  const activityFeed = useMemo((): ActivityItem[] => {
    return insights.recentActivity.map(item => ({
      id: item.id, type: item.type, title: item.title, timestamp: item.timestamp,
      case: { name: item.entityName, kyc: item.kycRef },
      snippet: item.snippet ?? undefined,
    }));
  }, [insights.recentActivity]);

  return (
    <div className="page-shell space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Command center</p>
          <h1 className="page-title">Welcome back, {firstName}</h1>
          <p className="text-sm text-muted-foreground mt-1">KYC Entity Status and Forecast summary</p>
        </div>
        <div className="relative shrink-0">
          <Calendar className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value as "month" | "week")}
            className="appearance-none bg-card border border-border rounded-lg pl-9 pr-8 py-2 text-sm font-medium text-foreground shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 hover:bg-secondary/40 transition-colors"
          >
            <option value="month">Current Month</option>
            <option value="week">Current Week</option>
          </select>
          <ChevronDown className="size-4 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Due this Month */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <div className="flex items-start justify-between mb-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Due this {selectedPeriod === "week" ? "Week" : "Month"}
            </p>
            <div className="size-8 rounded-md bg-primary/10 grid place-items-center">
              <Calendar className="size-4 text-primary" />
            </div>
          </div>
          <p className="text-4xl font-bold tabular-nums">{kpis.dueThisMonth}</p>
          <div className="mt-3 flex items-center gap-6">
            <div>
              <p className="text-xl font-bold tabular-nums text-primary">{kpis.completionPct}%</p>
              <p className="text-[11px] text-muted-foreground">Completion</p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums">{kpis.inProgress}</p>
              <p className="text-[11px] text-muted-foreground">In Progress</p>
            </div>
          </div>
        </div>

        {/* Overdue */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Overdue</p>
            <div className={cn("size-8 rounded-md grid place-items-center", kpis.overdue > 0 ? "bg-alert/10" : "bg-success/10")}>
              <CalendarX className={cn("size-4", kpis.overdue > 0 ? "text-alert" : "text-success")} />
            </div>
          </div>
          <p className={cn("text-4xl font-bold tabular-nums", kpis.overdue > 0 ? "text-alert" : "text-success")}>
            {kpis.overdue}
          </p>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">
              {kpis.overdue === 0
                ? "All cases are within SLA"
                : `${kpis.overdue} case${kpis.overdue !== 1 ? "s" : ""} past due date`}
            </p>
            {kpis.overdue > 0 && (
              <button
                onClick={() => navigate("/work-queue")}
                className="mt-1 text-xs font-medium text-alert hover:underline flex items-center gap-1"
              >
                View overdue cases <ChevronRight className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* Due in Next 3 Months */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Due in Next 3 Months</p>
            <div className="size-8 rounded-md bg-secondary grid place-items-center">
              <Calendar className="size-4 text-muted-foreground" />
            </div>
          </div>
          <p className="text-4xl font-bold tabular-nums">{kpis.dueNext3M}</p>
          <p className="mt-3 text-xs text-muted-foreground">Upcoming renewal workload</p>
        </div>

      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-12 gap-6">

        {/* Left: cases + bottom row */}
        <div className="col-span-12 xl:col-span-8 space-y-6">

          {/* Cases — dropdown multi-view */}
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 gap-3">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold">Cases</h3>
                {highCount > 0 && (
                  <Chip variant="high">
                    <AlertTriangle className="size-3 mr-1" />{highCount} High
                  </Chip>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <select
                    value={pendingView}
                    onChange={e => setPendingView(e.target.value as PendingBucket)}
                    className="appearance-none bg-card border border-border rounded-md pl-3 pr-8 py-1.5 text-sm font-medium text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 hover:bg-secondary/40 transition-colors"
                  >
                    {PENDING_VIEWS.map(v => (
                      <option key={v.key} value={v.key}>{v.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="size-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <button
                  onClick={() => navigate("/work-queue")}
                  className="text-xs font-medium text-primary hover:underline flex items-center gap-1 whitespace-nowrap"
                >
                  View all <ChevronRight className="size-3" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-[80px_1fr_60px_auto] text-[10px] font-medium uppercase tracking-wide text-muted-foreground pb-2 border-b border-border gap-3">
              <span>Priority</span>
              <span>Case / Entity</span>
              <span className="text-right">Exceptions</span>
              <span className="text-right">Due</span>
            </div>

            <ul className="divide-y divide-border">
              {visibleCases.length === 0 && (
                <li className="py-10 text-center">
                  <CheckCircle2 className="size-7 text-success/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No cases in {PENDING_VIEWS.find(v => v.key === pendingView)?.label}
                  </p>
                </li>
              )}
              {visibleCases.slice(0, 7).map(c => (
                <li key={c.id}>
                  <Link
                    to="/work-queue/review"
                    state={{ entities: [{ name: c.entity, kyc: c.id }] }}
                    className="grid grid-cols-[80px_1fr_60px_auto] gap-3 py-2.5 items-center hover:bg-secondary/30 -mx-2 px-2 rounded-md transition-colors"
                  >
                    <Chip
                      variant={c.priority === "High" ? "high" : c.priority === "Medium" ? "medium" : "low"}
                      className="w-fit text-[10px]"
                    >
                      {c.priority}
                    </Chip>
                    <div className="min-w-0">
                      <p className="text-[13px]">
                        <span className="font-semibold">{c.id}</span>{" "}
                        <span className="text-muted-foreground">{c.entity}</span>
                      </p>
                    </div>
                    <p className="text-xs font-medium text-right tabular-nums text-muted-foreground">
                      {c.exceptions > 0
                        ? <span className="text-alert font-semibold">{c.exceptions}</span>
                        : "—"}
                    </p>
                    <p className={cn("text-xs font-medium whitespace-nowrap", c.dueToday ? "text-alert" : "text-foreground")}>
                      {c.due}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Bottom row: Agent Runs + Exception Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Most Frequent Agent Runs */}
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="size-4 text-primary" />
                <h3 className="text-sm font-semibold">Most Frequent Agent Runs</h3>
              </div>
              <div className="space-y-3">
                {insightsError && (
                  <p className="py-8 text-center text-sm text-alert">Agent run insights could not be loaded.</p>
                )}
                {!insightsError && insights.frequentAgentRuns.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">No agent runs recorded yet.</p>
                )}
                {insights.frequentAgentRuns.map(f => (
                  <div key={f.slug}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{f.name}</span>
                      <span className="text-xs font-semibold tabular-nums">{f.runs}</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(f.runs / Math.max(...insights.frequentAgentRuns.map(run => run.runs), 1)) * 100}%`,
                          backgroundColor: NAVY,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Exception Summary */}
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert className="size-4 text-primary" />
                <h3 className="text-sm font-semibold">Exception Summary</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="text-left pb-2 font-medium">Exception Type</th>
                    <th className="text-center pb-2 font-medium">Open</th>
                    <th className="text-center pb-2 font-medium">Severity</th>
                    <th className="text-right pb-2 font-medium">Age</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {insights.exceptionSummary.length === 0 && (
                    <tr><td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No open exceptions.</td></tr>
                  )}
                  {insights.exceptionSummary.map(ex => (
                    <tr key={ex.type} className="hover:bg-secondary/30 transition-colors">
                      <td className="py-2.5 text-[13px] font-medium pr-2">{ex.type}</td>
                      <td className="py-2.5 text-sm text-center tabular-nums font-semibold">{ex.open}</td>
                      <td className="py-2.5 text-center">
                        {ex.severity
                          ? <Chip variant={ex.severity} className="text-[10px]">{ex.severity[0].toUpperCase() + ex.severity.slice(1)}</Chip>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2.5 text-xs text-right tabular-nums text-muted-foreground">{ex.ageDays}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>

        {/* Right: activity feed */}
        <aside className="col-span-12 xl:col-span-4">
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold mb-4">Recent Activity</h3>
            <ul className="space-y-1">
              {activityFeed.length === 0 && (
                <li className="py-10 text-center text-sm text-muted-foreground">No activity recorded yet.</li>
              )}
              {activityFeed.map(item => {
                const meta = COLLAB_META[item.type];
                const Icon = meta.icon;
                return (
                  <li key={item.id}>
                    <Link
                      to="/work-queue/review"
                      state={{ entities: [item.case] }}
                      className="flex items-start gap-3 -mx-2 px-2 py-2 rounded-md hover:bg-secondary/40 transition-colors"
                    >
                      <span className={cn("size-7 rounded-md grid place-items-center shrink-0 mt-0.5", meta.tone)}>
                        <Icon className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] leading-tight">{item.title}</p>
                        {item.snippet && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 italic">
                            "{item.snippet}"
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground/70 mt-0.5">{formatActivityTime(item.timestamp)}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

      </div>
    </div>
  );
};

export default Dashboard;
