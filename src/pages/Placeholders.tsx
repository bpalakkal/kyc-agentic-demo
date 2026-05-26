import { FileBarChart2, Download, ArrowUpRight, ArrowDownRight, ShieldAlert, Clock, CheckCircle2, Users, FileText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const Placeholder = ({ title, blurb }: { title: string; blurb: string }) => (
  <div className="px-6 py-12 max-w-3xl">
    <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
    <p className="text-sm text-muted-foreground mt-2">{blurb}</p>
    <div className="mt-8 rounded-xl border border-dashed border-border bg-card/50 h-64 grid place-items-center text-sm text-muted-foreground">
      Coming soon
    </div>
  </div>
);

export const EvidenceLocker = () => <Placeholder title="Evidence Locker" blurb="Source documents, regulatory filings, and audit-grade evidence for every case." />;

// ---------------- Reports ----------------

type Kpi = { label: string; value: string; unit?: string; trend?: { dir: "up" | "down"; text: string; good?: boolean }; icon: React.ReactNode };

const kpis: Kpi[] = [
  { label: "Cases closed (30d)", value: "184", trend: { dir: "up", text: "+12% vs prior 30d", good: true }, icon: <CheckCircle2 className="size-4" /> },
  { label: "Avg cycle time", value: "3.2", unit: "days", trend: { dir: "down", text: "-0.6d vs prior 30d", good: true }, icon: <Clock className="size-4" /> },
  { label: "SLA breach rate", value: "4.8", unit: "%", trend: { dir: "down", text: "-1.4pp vs prior 30d", good: true }, icon: <ShieldAlert className="size-4" /> },
  { label: "Auto-resolved by agent", value: "61", unit: "%", trend: { dir: "up", text: "+9pp vs prior 30d", good: true }, icon: <Sparkles className="size-4" /> },
];

type Report = {
  id: string;
  title: string;
  desc: string;
  category: "Operations" | "Compliance" | "Audit" | "Executive";
  updated: string;
  format: "PDF" | "XLSX" | "CSV";
  icon: React.ReactNode;
};

const reports: Report[] = [
  { id: "r-sla", title: "SLA Performance by DRG", desc: "Breach rate, time-to-resolve and queue depth across all Designated Review Groups for the period.", category: "Operations", updated: "Today, 06:00", format: "PDF", icon: <Clock className="size-4" /> },
  { id: "r-exc", title: "Exception Trends — Last 90 Days", desc: "Volume and category mix of exceptions raised, broken down by source agent and resolution outcome.", category: "Operations", updated: "Today, 06:00", format: "XLSX", icon: <FileBarChart2 className="size-4" /> },
  { id: "r-edd", title: "EDD Coverage Report", desc: "Enhanced Due Diligence completion rates against policy POL-EDD-23, including jurisdiction triggers.", category: "Compliance", updated: "Yesterday, 18:30", format: "PDF", icon: <ShieldAlert className="size-4" /> },
  { id: "r-psc", title: "PSC & Beneficial Ownership Drift", desc: "Discrepancies between filed PSC registers and internal CRM across UK / Jersey / US-domiciled entities.", category: "Compliance", updated: "Yesterday, 18:30", format: "XLSX", icon: <Users className="size-4" /> },
  { id: "r-audit", title: "Agent Decision Audit Trail", desc: "Every action taken by the AI agent system with citations, confidence and reviewer sign-off chain.", category: "Audit", updated: "Today, 06:00", format: "CSV", icon: <FileText className="size-4" /> },
  { id: "r-sign", title: "Reviewer Sign-Off Log", desc: "Per-analyst case throughput, override frequency and four-eyes approvals for the reporting period.", category: "Audit", updated: "Today, 06:00", format: "CSV", icon: <CheckCircle2 className="size-4" /> },
  { id: "r-exec", title: "Executive KYC Health Pack", desc: "One-page board-ready summary: cases, SLA, alerts, agent performance and remediation backlog.", category: "Executive", updated: "Mon, 07:00", format: "PDF", icon: <Sparkles className="size-4" /> },
  { id: "r-reg", title: "Regulatory Filing Calendar", desc: "Upcoming Companies House, FCA Gabriel and AIFMD obligations across the portfolio over the next 90 days.", category: "Executive", updated: "Mon, 07:00", format: "PDF", icon: <FileBarChart2 className="size-4" /> },
];

const cats: Report["category"][] = ["Operations", "Compliance", "Audit", "Executive"];
const catTone: Record<Report["category"], string> = {
  Operations: "bg-info-soft text-primary",
  Compliance: "bg-warning-soft text-warning",
  Audit: "bg-secondary text-foreground",
  Executive: "bg-success-soft text-success",
};

export const Reports = () => {
  return (
    <div className="px-6 py-6 max-w-[1280px]">
      <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Compliance reporting and exports across DRGs, entities and exceptions. Period: last 30 days.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-9 px-4 rounded-full border border-border bg-card text-sm hover:bg-secondary/50 transition-colors">Schedule report</button>
          <button className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:opacity-95">New custom report</button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-semibold tabular-nums">{k.value}</span>
                {k.unit && <span className="text-sm text-muted-foreground">{k.unit}</span>}
              </div>
              {k.trend && (
                <p className={cn(
                  "mt-1.5 text-xs flex items-center gap-1 font-medium",
                  k.trend.good ? "text-success" : "text-alert"
                )}>
                  {k.trend.dir === "up" ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                  {k.trend.text}
                </p>
              )}
            </div>
            <div className="size-9 rounded-lg grid place-items-center bg-secondary text-muted-foreground shrink-0">
              {k.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Reports by category */}
      <div className="space-y-6">
        {cats.map((cat) => {
          const items = reports.filter((r) => r.category === cat);
          return (
            <section key={cat} className="rounded-xl border border-border bg-card overflow-hidden">
              <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/40">
                <div className="flex items-center gap-2">
                  <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium", catTone[cat])}>{cat}</span>
                  <span className="text-xs text-muted-foreground">{items.length} reports</span>
                </div>
              </header>
              <ul className="divide-y divide-border">
                {items.map((r) => (
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
                      <p className="text-[11px] text-muted-foreground/80 mt-1.5">Updated {r.updated}</p>
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
    </div>
  );
};
