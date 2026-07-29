/*
 * Reports — analytics dashboard + report library
 *
 * ─── DB tables needed ────────────────────────────────────────────────────────
 *
 * ALREADY IN SUPABASE:
 *   entities   (kyc_ref, entity_name, risk_rating, priority, status,
 *               jurisdiction, due_date, case_owner, drg, created_at, updated_at)
 *   exceptions (id, kyc_ref, exception_type, status, resolved_at,
 *               resolved_by, resolution, created_at)
 *
 * ADD THESE THREE:
 *
 *   periodic_reviews
 *     id             uuid PRIMARY KEY DEFAULT gen_random_uuid()
 *     kyc_ref        text REFERENCES entities(kyc_ref)
 *     review_type    text        -- 'Annual' | 'Triggered' | 'Enhanced'
 *     due_date       date
 *     completed_date date
 *     status         text        -- 'scheduled' | 'in_progress' | 'overdue' | 'completed'
 *     assigned_to    text
 *     created_at     timestamptz DEFAULT now()
 *
 *   sla_snapshots                -- one row per day, written by a scheduled job
 *     id             uuid PRIMARY KEY DEFAULT gen_random_uuid()
 *     snapshot_date  date UNIQUE
 *     on_track       int
 *     at_risk        int
 *     breached       int
 *     total          int
 *     created_at     timestamptz DEFAULT now()
 *
 *   audit_log                    -- append-only; never update/delete
 *     id             uuid PRIMARY KEY DEFAULT gen_random_uuid()
 *     kyc_ref        text
 *     action         text        -- 'case_opened' | 'exception_raised'
 *                                --  | 'exception_resolved' | 'status_changed'
 *                                --  | 'review_completed'  | 'agent_action'
 *     actor          text        -- user email or 'agent:<agent-id>'
 *     details        jsonb
 *     created_at     timestamptz DEFAULT now()
 *
 * SUGGESTED INDEXES:
 *   entities(risk_rating), entities(jurisdiction), entities(due_date)
 *   exceptions(kyc_ref), exceptions(status), exceptions(exception_type)
 *   periodic_reviews(due_date), periodic_reviews(status)
 *   audit_log(kyc_ref), audit_log(created_at)
 */

import { useState } from "react";
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  Download, FileBarChart2, ShieldAlert, Clock, CheckCircle2,
  Users, FileText, Sparkles, AlertTriangle,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Chart colour palette ─────────────────────────────────────────────────────
const C = {
  primary: "hsl(var(--chart-1))",
  blue2:   "hsl(var(--chart-2))",
  grey:    "hsl(var(--chart-3))",
  success: "hsl(var(--success))",
  alert:   "hsl(var(--alert))",
  warning: "hsl(var(--warning))",
  high:    "hsl(var(--risk-high))",
  medium:  "hsl(var(--risk-medium))",
  low:     "hsl(var(--risk-low))",
};

// ─── Mock data ─────────────────────────────────────────────────────────────────
// Each comment shows the Supabase query to replace it with.

// supabase.from('sla_snapshots').select('*').order('snapshot_date').limit(6)
const SLA_TREND = [
  { month: "Jan", "On Track": 142, "At Risk": 18, Breached: 6  },
  { month: "Feb", "On Track": 138, "At Risk": 22, Breached: 8  },
  { month: "Mar", "On Track": 151, "At Risk": 15, Breached: 5  },
  { month: "Apr", "On Track": 156, "At Risk": 14, Breached: 4  },
  { month: "May", "On Track": 162, "At Risk": 12, Breached: 3  },
  { month: "Jun", "On Track": 168, "At Risk": 10, Breached: 2  },
];

// SELECT risk_rating, COUNT(*) FROM entities GROUP BY risk_rating
const RISK_DIST = [
  { name: "High",   value: 42, color: C.high    },
  { name: "Medium", value: 91, color: C.medium  },
  { name: "Low",    value: 47, color: C.low     },
];

// SELECT jurisdiction, risk_rating, COUNT(*) FROM entities GROUP BY 1,2
const JURISDICTION = [
  { j: "UK",         High: 18, Medium: 32, Low: 14 },
  { j: "Jersey",     High: 9,  Medium: 15, Low: 8  },
  { j: "BVI",        High: 7,  Medium: 12, Low: 5  },
  { j: "Cayman",     High: 5,  Medium: 10, Low: 6  },
  { j: "Luxembourg", High: 2,  Medium: 14, Low: 9  },
  { j: "US",         High: 1,  Medium: 8,  Low: 5  },
];

// SELECT exception_type, status, COUNT(*) FROM exceptions GROUP BY 1,2
const EXCEPTION_TYPES = [
  { type: "BO Percentage",       Open: 23, Resolved: 41 },
  { type: "Missing Docs",        Open: 18, Resolved: 67 },
  { type: "PEP Hit",             Open: 12, Resolved: 28 },
  { type: "Sanctions Screen",    Open: 8,  Resolved: 19 },
  { type: "Structure Mismatch",  Open: 15, Resolved: 34 },
  { type: "Stale Data",          Open: 9,  Resolved: 52 },
];

// SELECT CASE WHEN age<7 … END AS bucket, risk_rating, COUNT(*) FROM entities
// WHERE status='open' GROUP BY 1,2
const QUEUE_AGING = [
  { bucket: "0–7 days",   High: 8,  Medium: 14, Low: 6  },
  { bucket: "8–30 days",  High: 15, Medium: 28, Low: 12 },
  { bucket: "31–60 days", High: 11, Medium: 19, Low: 8  },
  { bucket: "60+ days",   High: 8,  Medium: 30, Low: 21 },
];

// SELECT status, COUNT(*) FROM periodic_reviews GROUP BY status
const REVIEWS_DUE = [
  { bucket: "Overdue",    count: 7,  color: C.alert   },
  { bucket: "< 30 days",  count: 18, color: C.warning  },
  { bucket: "30–60 days", count: 24, color: C.blue2    },
  { bucket: "60–90 days", count: 31, color: C.success  },
];

// ─── KPI strip data ───────────────────────────────────────────────────────────
const KPIS = [
  {
    label: "Cases Closed (30d)", value: "184",
    trend: { dir: "up"   as const, text: "+12% vs prior", good: true },
    icon: <CheckCircle2 className="size-4" />, accent: "success",
  },
  {
    label: "Avg Cycle Time", value: "3.2", unit: "days",
    trend: { dir: "down" as const, text: "−0.6d vs prior", good: true },
    icon: <Clock className="size-4" />, accent: "success",
  },
  {
    label: "SLA Breach Rate", value: "1.1", unit: "%",
    trend: { dir: "down" as const, text: "−3.7pp vs prior", good: true },
    icon: <ShieldAlert className="size-4" />, accent: "success",
  },
  {
    label: "Open Exceptions", value: "85",
    trend: { dir: "down" as const, text: "−12 this month", good: true },
    icon: <AlertTriangle className="size-4" />, accent: "warning",
  },
];

const TABS = ["Overview", "SLA & Queue", "Exceptions", "Risk & Geography", "Report Library"] as const;
type Tab = typeof TABS[number];

// ─── Shared sub-components ────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card shadow-lg px-3 py-2 text-[12px]">
      {label && <p className="font-semibold text-foreground mb-1.5">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.name} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-full shrink-0" style={{ background: p.color ?? p.fill }} />
          {p.name}: <strong className="text-foreground ml-0.5">{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

const Card = ({
  title, subtitle, children, className,
}: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) => (
  <div className={cn("rounded-xl border border-border bg-card overflow-hidden shadow-sm", className)}>
    <div className="px-4 py-2.5 border-b border-border">
      <p className="text-[13px] font-bold">{title}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

// ─── Tab: Overview ────────────────────────────────────────────────────────────
const Overview = () => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
    <Card title="SLA Trend — Last 6 Months" subtitle="Cases on track vs. at risk vs. breached" className="lg:col-span-2">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={SLA_TREND} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="gSuccess" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.success} stopOpacity={0.15} />
              <stop offset="95%" stopColor={C.success} stopOpacity={0}    />
            </linearGradient>
            <linearGradient id="gWarning" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.warning} stopOpacity={0.15} />
              <stop offset="95%" stopColor={C.warning} stopOpacity={0}    />
            </linearGradient>
            <linearGradient id="gAlert" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.alert} stopOpacity={0.2} />
              <stop offset="95%" stopColor={C.alert} stopOpacity={0}   />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="On Track" stroke={C.success} fill="url(#gSuccess)" strokeWidth={2} dot={false} />
          <Area type="monotone" dataKey="At Risk"  stroke={C.warning} fill="url(#gWarning)" strokeWidth={2} dot={false} />
          <Area type="monotone" dataKey="Breached" stroke={C.alert}   fill="url(#gAlert)"   strokeWidth={2} dot={false} />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        </AreaChart>
      </ResponsiveContainer>
    </Card>

    <Card title="Risk Distribution" subtitle="Current portfolio · 180 entities">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={RISK_DIST} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="value">
            {RISK_DIST.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-5 mt-2">
        {RISK_DIST.map(d => (
          <div key={d.name} className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: d.color }} />
              {d.name}
            </div>
            <strong className="text-[15px] tabular-nums">{d.value}</strong>
          </div>
        ))}
      </div>
    </Card>

    <Card title="Exception Types — Open" subtitle="Top exception categories currently open" className="lg:col-span-3">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={EXCEPTION_TYPES} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="type" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="Open"     fill={C.alert}   radius={[3, 3, 0, 0]} />
          <Bar dataKey="Resolved" fill={C.success} radius={[3, 3, 0, 0]} />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  </div>
);

// ─── Tab: SLA & Queue ─────────────────────────────────────────────────────────
const SlaQueue = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
    <Card title="Monthly SLA Performance" subtitle="On track / at risk / breached by month">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={SLA_TREND} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="On Track" fill={C.success} radius={[3, 3, 0, 0]} />
          <Bar dataKey="At Risk"  fill={C.warning} radius={[3, 3, 0, 0]} />
          <Bar dataKey="Breached" fill={C.alert}   radius={[3, 3, 0, 0]} />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        </BarChart>
      </ResponsiveContainer>
    </Card>

    <Card title="Work Queue Aging" subtitle="Open cases by age bucket and risk rating">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={QUEUE_AGING} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="bucket" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="High"   fill={C.high}   radius={[3, 3, 0, 0]} />
          <Bar dataKey="Medium" fill={C.medium} radius={[3, 3, 0, 0]} />
          <Bar dataKey="Low"    fill={C.low}    radius={[3, 3, 0, 0]} />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        </BarChart>
      </ResponsiveContainer>
    </Card>

    {/* Summary row */}
    {[
      { label: "Cases ≥ 30 days open", value: "97",  note: "54% of queue" },
      { label: "Avg queue age",        value: "28",  note: "days" },
      { label: "High risk > 30d",      value: "19",  note: "require escalation" },
      { label: "SLA breached (Jun)",   value: "2",   note: "vs 6 in Jan ↓" },
    ].map(s => (
      <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
        <p className="text-2xl font-bold tabular-nums mt-1.5">{s.value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{s.note}</p>
      </div>
    ))}
  </div>
);

// ─── Tab: Exceptions ──────────────────────────────────────────────────────────
const Exceptions = () => (
  <div className="space-y-5">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[
        { label: "Total Raised (90d)", value: "241", note: "across all types",    accent: "" },
        { label: "Resolved",           value: "156", note: "65% resolution rate", accent: "success" },
        { label: "Still Open",         value: "85",  note: "35% pending",         accent: "warning" },
        { label: "Avg Time to Close",  value: "4.8", note: "days",                accent: "" },
      ].map(s => (
        <div key={s.label} className={cn(
          "rounded-xl border px-4 py-3.5 bg-card",
          s.accent === "success" ? "border-success-soft-border bg-gradient-to-br from-success-soft to-card"
          : s.accent === "warning" ? "border-warning-soft-border bg-gradient-to-br from-warning-soft to-card"
          : "border-border",
        )}>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
          <p className={cn("text-2xl font-bold tabular-nums mt-1.5",
            s.accent === "success" ? "text-success" : s.accent === "warning" ? "text-warning" : ""
          )}>{s.value}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{s.note}</p>
        </div>
      ))}
    </div>

    <Card title="Exception Volume by Type" subtitle="Open vs resolved — last 90 days">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={EXCEPTION_TYPES} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 110 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={106} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="Open"     fill={C.alert}   radius={[0, 3, 3, 0]} />
          <Bar dataKey="Resolved" fill={C.success} radius={[0, 3, 3, 0]} />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  </div>
);

// ─── Tab: Risk & Geography ────────────────────────────────────────────────────
const RiskGeo = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
    <Card title="Risk Concentration by Jurisdiction" subtitle="Entity count — High / Medium / Low (stacked)">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={JURISDICTION} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="j" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="High"   stackId="a" fill={C.high}   />
          <Bar dataKey="Medium" stackId="a" fill={C.medium} />
          <Bar dataKey="Low"    stackId="a" fill={C.low}    radius={[3, 3, 0, 0]} />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        </BarChart>
      </ResponsiveContainer>
    </Card>

    <Card title="Periodic Reviews Due" subtitle="Upcoming review obligations by time horizon">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={REVIEWS_DUE} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="bucket" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {REVIEWS_DUE.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {REVIEWS_DUE.map(d => (
          <div key={d.bucket} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-[12px]">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="text-muted-foreground">{d.bucket}</span>
            </div>
            <strong className="tabular-nums">{d.count}</strong>
          </div>
        ))}
      </div>
    </Card>

    <Card title="Risk Profile Summary" subtitle="Portfolio breakdown" className="lg:col-span-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: "High-risk jurisdictions",    value: "BVI, Cayman", note: "FATF elevated scrutiny" },
          { label: "High-risk entities",          value: "42 / 180",   note: "23% of portfolio" },
          { label: "Jurisdiction concentration",  value: "UK",         note: "35% of all entities" },
          { label: "UBO gaps identified",         value: "23",         note: "open BO exceptions" },
          { label: "PEP screening hits",          value: "12",         note: "8 cleared, 4 pending" },
          { label: "Reviews overdue",             value: "7",          note: "escalation required" },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border bg-secondary/30 px-4 py-3">
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
            <p className="text-[15px] font-semibold mt-1">{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.note}</p>
          </div>
        ))}
      </div>
    </Card>
  </div>
);

// ─── Tab: Report Library ──────────────────────────────────────────────────────
type ReportMeta = {
  id: string; title: string; desc: string;
  category: "Operations" | "Compliance" | "Audit" | "Executive";
  updated: string; format: "PDF" | "XLSX" | "CSV";
  icon: React.ReactNode;
};

const REPORT_CATALOG: ReportMeta[] = [
  { id: "r-sla",   title: "SLA Performance by DRG",           desc: "Breach rate, time-to-resolve and queue depth across all Designated Review Groups.", category: "Operations", updated: "Today, 06:00",     format: "PDF",  icon: <Clock className="size-4" /> },
  { id: "r-exc",   title: "Exception Trends — Last 90 Days",  desc: "Volume and category mix of exceptions, broken down by source and resolution outcome.",  category: "Operations", updated: "Today, 06:00",     format: "XLSX", icon: <FileBarChart2 className="size-4" /> },
  { id: "r-edd",   title: "EDD Coverage Report",              desc: "Enhanced Due Diligence completion rates against policy POL-EDD-23, including jurisdiction triggers.", category: "Compliance", updated: "Yesterday, 18:30", format: "PDF",  icon: <ShieldAlert className="size-4" /> },
  { id: "r-psc",   title: "PSC & Beneficial Ownership Drift", desc: "Discrepancies between filed PSC registers and internal CRM across UK / Jersey / US entities.", category: "Compliance", updated: "Yesterday, 18:30", format: "XLSX", icon: <Users className="size-4" /> },
  { id: "r-audit", title: "Agent Decision Audit Trail",       desc: "Every action taken by the AI agent system with citations, confidence and reviewer sign-off.", category: "Audit", updated: "Today, 06:00",     format: "CSV",  icon: <FileText className="size-4" /> },
  { id: "r-sign",  title: "Reviewer Sign-Off Log",            desc: "Per-analyst throughput, override frequency and four-eyes approvals for the reporting period.", category: "Audit", updated: "Today, 06:00",     format: "CSV",  icon: <CheckCircle2 className="size-4" /> },
  { id: "r-exec",  title: "Executive KYC Health Pack",        desc: "Board-ready one-pager: cases, SLA, alerts, agent performance and remediation backlog.", category: "Executive", updated: "Mon, 07:00",       format: "PDF",  icon: <Sparkles className="size-4" /> },
  { id: "r-reg",   title: "Regulatory Filing Calendar",       desc: "Upcoming Companies House, FCA Gabriel and AIFMD obligations across the portfolio.", category: "Executive", updated: "Mon, 07:00",       format: "PDF",  icon: <FileBarChart2 className="size-4" /> },
];

const CAT_TONE: Record<ReportMeta["category"], string> = {
  Operations: "bg-info-soft text-primary",
  Compliance: "bg-warning-soft text-warning",
  Audit:      "bg-secondary text-foreground",
  Executive:  "bg-success-soft text-success",
};

const CATS: ReportMeta["category"][] = ["Operations", "Compliance", "Audit", "Executive"];

const ReportLibrary = () => (
  <div className="space-y-5">
    {CATS.map(cat => {
      const items = REPORT_CATALOG.filter(r => r.category === cat);
      return (
        <section key={cat} className="rounded-xl border border-border bg-card overflow-hidden">
          <header className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-secondary/40">
            <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium", CAT_TONE[cat])}>{cat}</span>
            <span className="text-xs text-muted-foreground">{items.length} reports</span>
          </header>
          <ul className="divide-y divide-border">
            {items.map(r => (
              <li key={r.id} className="px-5 py-4 flex items-start gap-4 hover:bg-secondary/30 transition-colors">
                <span className="size-9 rounded-lg bg-secondary text-muted-foreground grid place-items-center shrink-0 mt-0.5">
                  {r.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-semibold">{r.title}</p>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-border text-muted-foreground">{r.format}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{r.desc}</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1.5">Updated {r.updated}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button className="h-8 px-3 rounded-full border border-border text-xs hover:bg-secondary/60 transition-colors">Preview</button>
                  <button className="h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5 hover:opacity-95">
                    <Download className="size-3" /> Download
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      );
    })}
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────
const Reports = () => {
  const [tab, setTab] = useState<Tab>("Overview");

  return (
    <div className="page-shell !max-w-[1320px]">
      <div role="note" className="mb-5 flex items-start gap-2.5 rounded-lg border border-warning-soft-border bg-warning-soft px-4 py-3">
        <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
        <div className="text-[13px]">
          <p className="font-semibold text-foreground">Illustrative data</p>
          <p className="text-muted-foreground mt-0.5">This page demonstrates report layouts with sample figures. It is not connected to live case data; do not use these numbers for reporting or decisions.</p>
        </div>
      </div>
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Intelligence</p>
          <h1 className="page-title">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Compliance analytics and report exports · Last 30 days
          </p>
        </div>
        <button className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg shadow-primary/20 flex items-center gap-2 hover:opacity-95">
          <Download className="size-3.5" /> Export
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {KPIS.map(k => (
          <div key={k.label} className={cn(
            "rounded-xl border border-border bg-card p-4 shadow-sm",
            k.accent === "success" ? "border-t-[3px] border-t-success"
            : k.accent === "warning" ? "border-t-[3px] border-t-warning"
            : k.accent === "alert"   ? "border-t-[3px] border-t-alert"
            : "border-t-[3px] border-t-primary",
          )}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold tabular-nums">{k.value}</span>
              {k.unit && <span className="text-sm text-muted-foreground">{k.unit}</span>}
            </div>
            <p className={cn("mt-1.5 text-xs flex items-center gap-1 font-medium", k.trend.good ? "text-success" : "text-alert")}>
              {k.trend.dir === "up" ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {k.trend.text}
            </p>
          </div>
        ))}
      </div>

      {/* Tab nav */}
      <div className="flex gap-0.5 mb-5 border-b border-border overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Panels */}
      {tab === "Overview"         && <Overview />}
      {tab === "SLA & Queue"      && <SlaQueue />}
      {tab === "Exceptions"       && <Exceptions />}
      {tab === "Risk & Geography" && <RiskGeo />}
      {tab === "Report Library"   && <ReportLibrary />}
    </div>
  );
};

export default Reports;
