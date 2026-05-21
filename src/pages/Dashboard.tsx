import { AlertTriangle, Clock, ChevronRight, Sparkles, Paperclip, Maximize2, MessageSquare, FileText, Globe, ArrowUpRight, ArrowDownRight, Timer } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { Link, useNavigate } from "react-router-dom";
import { Chip } from "@/components/Chip";
import { cn } from "@/lib/utils";

const priorityCases = [
  { priority: "High", id: "KYC-30214", entity: "Brevan Howard Asset Management LLP", note: "PSC nature-of-control change undisclosed — Companies House filing overdue.", due: "2 hrs", est: "45 min" },
  { priority: "High", id: "KYC-30188", entity: "Marshall Wace LLP", note: "FCA permission scope change pending evidence — SLA closes today.", due: "Today", est: "30 min" },
  { priority: "Medium", id: "KYC-30201", entity: "Brevan Howard Asset Management LLP", note: "Jersey-domiciled corporate member triggers EDD review.", due: "Tomorrow", est: "20 min" },
  { priority: "Medium", id: "KYC-30207", entity: "Marshall Wace LLP", note: "AUM disclosure 2025 not yet reconciled with FCA Gabriel return.", due: "Friday", est: "1.5 hrs" },
  { priority: "Low", id: "KYC-30222", entity: "Brevan Howard Asset Management LLP", note: "Previous company name 'Rivage Capital' chain-of-title verification.", due: "Next Week", est: "15 min" },
] as const;

const pieData = [
  { name: "Not Started", value: 20, color: "hsl(var(--chart-3))" },
  { name: "In Progress", value: 30, color: "hsl(var(--chart-1))" },
  { name: "Pending Feedback", value: 30, color: "hsl(var(--chart-2))" },
  { name: "Complete", value: 20, color: "hsl(var(--chart-4))" },
];

const casesOverTime = [
  { day: "Mon", new: 14, completed: 12, overdue: 4 },
  { day: "Tue", new: 18, completed: 11, overdue: 5 },
  { day: "Wed", new: 13, completed: 15, overdue: 4 },
  { day: "Thu", new: 20, completed: 17, overdue: 6 },
  { day: "Fri", new: 16, completed: 14, overdue: 5 },
  { day: "Sat", new: 11, completed: 13, overdue: 3 },
  { day: "Sun", new: 14, completed: 16, overdue: 4 },
];

const responseTrend = [
  { day: "Mon", v: 3.8 }, { day: "Tue", v: 3.4 }, { day: "Wed", v: 3.5 },
  { day: "Thu", v: 3.6 }, { day: "Fri", v: 3.1 }, { day: "Sat", v: 3.0 }, { day: "Sun", v: 3.2 },
];

const aiActions = [
  { dot: "alert", title: "Sign off on KYC-30214", sub: "Brevan Howard · PSC filing overdue", chip: "Recommended" },
  { dot: "alert", title: "Escalate KYC-30188 FCA scope", sub: "Marshall Wace · SLA breach today" },
  { dot: "warning", title: "Run EDD on Jersey corporate member", sub: "BH Partnership Holdings Limited" },
  { dot: "muted", title: "Reconcile Marshall Wace AUM", sub: "FCA Gabriel vs CRM mismatch" },
];

const collab = [
  { icon: MessageSquare, title: "Quinn Doe commented on Brevan Howard case file", time: "Today, 7:08 AM" },
  { icon: Globe, title: "AI Agent pulled 3 fresh Companies House filings", time: "Yesterday, 3:12 PM" },
  { icon: FileText, title: 'You confirmed PSC for Marshall Wace LLP', time: "April 22, 2026, 7:18 AM" },
  { icon: MessageSquare, title: "Aanya Sharma flagged a Jersey EDD finding", time: "April 22, 2026, 6:03 AM" },
];

const Stat = ({ label, value, unit, trend, accent, icon, soft = false, onClick }: {
  label: string; value: string; unit?: string; trend?: { dir: "up" | "down"; text: string };
  accent?: "alert"; icon?: React.ReactNode; soft?: boolean; onClick?: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "group rounded-xl border bg-card p-5 flex items-start justify-between gap-4 transition-all hover:shadow-md hover:-translate-y-0.5 text-left w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40",
      soft ? "border-alert-soft-border bg-gradient-to-br from-alert-soft to-card" : "border-border"
    )}>
    <div className="min-w-0">
      <p className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={cn("text-3xl font-semibold tracking-tight tabular-nums", accent === "alert" && "text-alert")}>{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {trend && (
        <p className={cn("mt-2 text-xs flex items-center gap-1 font-medium", trend.dir === "up" ? "text-alert" : "text-success")}>
          {trend.dir === "up" ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
          {trend.text}
        </p>
      )}
    </div>
    {icon && (
      <div className={cn(
        "size-10 rounded-lg grid place-items-center shrink-0 transition-colors",
        soft ? "bg-alert/10 text-alert" : "bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
      )}>{icon}</div>
    )}
  </button>
);

const dotColor = (k: string) =>
  k === "alert" ? "bg-alert" : k === "warning" ? "bg-warning" : "bg-muted-foreground/40";

const Dashboard = () => {
  const navigate = useNavigate();
  const goQueue = () => navigate("/work-queue");
  const goReview = () => navigate("/work-queue/review");
  return (
    <div className="px-6 py-6 grid grid-cols-12 gap-6">
      {/* Main column */}
      <div className="col-span-12 xl:col-span-9 space-y-6">
        {/* Page heading */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">KYC Refresh Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Real-time view of cases, SLAs and AI-recommended actions across your DRGs.</p>
          </div>
          <p className="text-xs text-muted-foreground">Last refreshed: Today, 8:42 AM</p>
        </div>

        {/* Top stat row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat
            label="Cases Requiring Attention"
            value="2"
            unit="cases"
            trend={{ dir: "up", text: "+2 since yesterday" }}
            icon={<AlertTriangle className="size-5" />}
            onClick={goQueue}
          />
          <Stat
            label="Avg Response Time"
            value="3.2"
            unit="days"
            trend={{ dir: "up", text: "0.4d vs yesterday" }}
            icon={<Clock className="size-5" />}
            onClick={goQueue}
          />
          <button
            type="button"
            onClick={goQueue}
            className="group rounded-xl border border-border bg-card p-5 flex items-start justify-between transition-all hover:shadow-md hover:-translate-y-0.5 text-left w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40">
            <div>
              <p className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground">Cases Complete</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight tabular-nums">48</span>
                <span className="text-xl text-muted-foreground">%</span>
              </div>
              <p className="mt-2 text-xs text-success flex items-center gap-1 font-medium">
                <ArrowDownRight className="size-3" /> 3% vs yesterday
              </p>
            </div>
            <div className="relative size-14">
              <svg viewBox="0 0 36 36" className="size-14 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--secondary))" strokeWidth="3.6" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--primary))" strokeWidth="3.6"
                  strokeDasharray="48 100" strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 grid place-items-center text-[10px] font-semibold text-primary">48%</span>
            </div>
          </button>
        </div>

        {/* Second stat row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Stat soft accent="alert" label="Compliance Alerts" value="2" icon={<AlertTriangle className="size-5" />} onClick={goQueue} />
          <Stat label="Decision Support" value="13" icon={<Sparkles className="size-5" />} onClick={goQueue} />
          <Stat label="Next to Complete" value="5" icon={<Timer className="size-5" />} onClick={goQueue} />
          <Stat label="Client Responses" value="3" icon={<MessageSquare className="size-5" />} onClick={goQueue} />
        </div>

        {/* Priority + Pie */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Priority */}
          <section className="rounded-xl border border-border bg-card p-5">
            <header className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-[15px] font-semibold">Priority Cases</h2>
                <Chip variant="high"><AlertTriangle className="size-3 mr-1" />2 High</Chip>
              </div>
              <button className="text-xs font-medium text-primary flex items-center gap-1 hover:underline">
                View all <ChevronRight className="size-3" />
              </button>
            </header>

            <div className="grid grid-cols-[80px_1fr_auto] text-[10px] font-medium uppercase tracking-wide text-muted-foreground pb-2 border-b border-border">
              <span>Priority</span>
              <span>Case / Entity</span>
              <span className="text-right">Due</span>
            </div>

            <ul className="divide-y divide-border">
              {priorityCases.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/work-queue/review"
                    className="grid grid-cols-[80px_1fr_auto] gap-3 py-3 items-start hover:bg-secondary/30 -mx-2 px-2 rounded-md transition-colors cursor-pointer"
                  >
                    <Chip
                      variant={c.priority === "High" ? "high" : c.priority === "Medium" ? "medium" : "low"}
                      className="w-fit"
                    >
                      {c.priority}
                    </Chip>
                    <div className="min-w-0">
                      <p className="text-[13px]">
                        <span className="font-semibold">{c.id}</span>{" "}
                        <span className="text-muted-foreground">{c.entity}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{c.note}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-xs font-medium", c.due.includes("hr") || c.due === "Today" ? "text-alert" : "text-foreground")}>{c.due}</p>
                      <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border text-[10px] text-muted-foreground">
                        <Timer className="size-2.5" /> {c.est}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Pie */}
          <section className="rounded-xl border border-border bg-card p-5">
            <header className="flex items-start justify-between mb-2">
              <div>
                <h2 className="text-[15px] font-semibold">Cases by Status</h2>
                <p className="text-xs text-muted-foreground">Operational workload distribution</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Total Active</p>
                <p className="text-2xl font-semibold">8</p>
              </div>
            </header>

            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={0} outerRadius={100} stroke="hsl(var(--card))" strokeWidth={2}
                    label={({ value }) => `${value}%`} labelLine={false}>
                    {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 space-y-1.5">
              {pieData.map((d) => (
                <li key={d.name} className="grid grid-cols-[1fr_auto_48px] items-center text-xs">
                  <span className="flex items-center gap-2 text-foreground">
                    <span className="size-2 rounded-full" style={{ background: d.color }} />
                    {d.name}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{Math.round((d.value / 100) * 10)}</span>
                  <span className="text-right text-muted-foreground tabular-nums">{d.value}%</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="rounded-xl border border-border bg-card p-5">
            <header className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-[15px] font-semibold">Cases Over Time</h2>
                <p className="text-xs text-muted-foreground">New, completed, and overdue</p>
              </div>
              <button className="text-xs border border-border rounded-md px-2.5 py-1 text-muted-foreground">Last 7 Days ▾</button>
            </header>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={casesOverTime} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} domain={[0, 24]} ticks={[0,6,12,18,24]} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="new" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="completed" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="overdue" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 text-xs mt-2">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-chart-1"/>New Cases</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-chart-4"/>Completed</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted-foreground/60"/>Overdue</span>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <header className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-[15px] font-semibold">Response Time Trend</h2>
                <p className="text-xs text-muted-foreground">Avg days vs SLA target</p>
              </div>
              <span className="text-xs text-muted-foreground">---- SLA</span>
            </header>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={responseTrend} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} domain={[2.65, 4.5]} ticks={[2.65,3.3,4.5]} />
                  <ReferenceLine y={3.0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="v" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--chart-1))" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      </div>

      {/* Right column: AI + collab */}
      <aside className="col-span-12 xl:col-span-3 space-y-6">
        <section className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground leading-relaxed">
            You currently have <span className="font-semibold text-foreground">5 cases</span> within a 48-hour SLA across the <span className="font-semibold text-foreground">London Alternatives DRG</span>, and <span className="font-semibold text-foreground">2 unresolved compliance alerts</span> requiring action.
          </p>

          <div className="mt-5 mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            AI-Recommended Actions
          </div>

          <ul className="divide-y divide-border">
            {aiActions.map((a) => (
              <li key={a.title} className="py-3 flex items-start gap-3">
                <span className={cn("mt-1.5 size-2 rounded-full shrink-0", dotColor(a.dot))} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium leading-tight">{a.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.sub}</p>
                </div>
                {a.chip && <Chip variant="high" className="shrink-0">{a.chip}</Chip>}
                <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-1" />
              </li>
            ))}
          </ul>

          <div className="mt-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">Ask a follow-up</p>
            <div className="rounded-xl border border-border p-3">
              <input
                className="w-full bg-transparent text-sm placeholder:text-muted-foreground outline-none"
                placeholder="Ask a follow up question"
              />
              <div className="flex items-center justify-between mt-3">
                <button className="text-muted-foreground hover:text-foreground"><Paperclip className="size-4" /></button>
                <button className="text-xs px-4 py-1.5 rounded-full border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors">Ask</button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <header className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-semibold">Collaboration &amp; Insights</h3>
            <button className="text-muted-foreground hover:text-foreground"><Maximize2 className="size-4" /></button>
          </header>
          <ul className="space-y-3">
            {collab.map((c, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="size-7 rounded-md bg-secondary grid place-items-center text-muted-foreground shrink-0">
                  <c.icon className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] leading-tight">{c.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
};

export default Dashboard;
