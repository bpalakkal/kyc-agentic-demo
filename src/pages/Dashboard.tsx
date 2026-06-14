import { useMemo, useState, useEffect } from "react";
import { AlertTriangle, Clock, ChevronRight, ChevronDown, Sparkles, Maximize2, MessageSquare, FileText, Bot, ArrowUpRight, ArrowDownRight, Timer, CheckCircle2, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Chip } from "@/components/Chip";
import { cn } from "@/lib/utils";
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

type PriorityCase = {
  priority: "High" | "Medium" | "Low";
  id: string;
  entity: string;
  note: string;
  due: string;
  est: string;
  status: "open" | "complete";
  dueToday: boolean;
  slaRisk: boolean;
};

function toPriorityCase(e: ApiEntity): PriorityCase {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const afterTomorrow = new Date(today); afterTomorrow.setDate(afterTomorrow.getDate() + 2);
  const dueDate = e.due_date ? new Date(e.due_date) : null;
  if (dueDate) dueDate.setHours(0, 0, 0, 0);
  const dueToday = dueDate ? dueDate <= today : false;
  const slaRisk = dueDate ? dueDate < afterTomorrow : false;
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
    note: `${e.open_exceptions_count} open exception${e.open_exceptions_count !== 1 ? "s" : ""} requiring resolution.`,
    due, dueToday, slaRisk,
    est: e.open_exceptions_count > 3 ? "45 min" : "30 min",
    status: e.status === "complete" ? "complete" : "open",
  };
}

type FilterKey = "all" | "high" | "today";

const aiActions: { dot: string; title: string; sub: string; chip?: string; reason: string; entity: CaseRef }[] = [
  { dot: "alert",   title: "Sign off on KYC-30214",                   sub: "Brevan Howard · PSC filing overdue",       chip: "Recommended", reason: "All exceptions have been resolved.",                                    entity: { name: "Brevan Howard Asset Management LLP", kyc: "KYC-30214" } },
  { dot: "alert",   title: "Escalate KYC-30188 FCA scope",            sub: "Marshall Wace · SLA breach today",                              reason: "SLA breaches in <4 hours with no client response.",                    entity: { name: "Marshall Wace LLP",                   kyc: "KYC-30188" } },
  { dot: "warning", title: "Run EDD on Jersey corporate member",       sub: "BH Partnership Holdings Limited",                               reason: "Jurisdiction matches EDD policy POL-EDD-23.",                         entity: { name: "Brevan Howard Asset Management LLP", kyc: "KYC-30214" } },
  { dot: "warning", title: "Reconcile Marshall Wace AUM",             sub: "FCA Gabriel vs CRM mismatch",                                    reason: "AUM delta of £180m detected between sources.",                        entity: { name: "Marshall Wace LLP",                   kyc: "KYC-30188" } },
  { dot: "muted",   title: "Backfill 'Rivage Capital' name alias",    sub: "Brevan Howard · CRM history sync",                               reason: "Companies House name history not yet in CRM.",                        entity: { name: "Brevan Howard Asset Management LLP", kyc: "KYC-30214" } },
  { dot: "muted",   title: "Request AIFMD Article 23 pack",           sub: "Marshall Wace · client outreach",                                reason: "New 'Managing an AIF' permission added on 02/11/2026.",               entity: { name: "Marshall Wace LLP",                   kyc: "KYC-30188" } },
  { dot: "muted",   title: "Add cleared name pair to sanctions allowlist", sub: "Marshall Wace PSC · false positive",                        reason: "Identity divergence on DOB and nationality confirmed.",                entity: { name: "Marshall Wace LLP",                   kyc: "KYC-30188" } },
];

type CollabType = "comment" | "ai" | "document" | "action";
type CaseRef = { name: string; kyc: string };

const collabMeta: Record<CollabType, { label: string; icon: typeof MessageSquare; tone: string }> = {
  comment: { label: "Comments", icon: MessageSquare, tone: "bg-info-soft text-primary" },
  ai: { label: "AI actions", icon: Bot, tone: "bg-success-soft text-success" },
  document: { label: "Documents", icon: FileText, tone: "bg-warning-soft text-warning" },
  action: { label: "User actions", icon: CheckCircle2, tone: "bg-secondary text-foreground" },
};

type AccentVariant = "alert" | "warning" | "success";

const ACCENT_TEXT: Record<AccentVariant, string> = {
  alert:   "text-alert",
  warning: "text-warning",
  success: "text-success",
};

const Stat = ({ label, value, unit, trend, accent, icon, onClick, active, topBorderClass }: {
  label: string; value: string; unit?: string; trend?: { dir: "up" | "down"; text: string };
  accent?: AccentVariant; icon?: React.ReactNode; onClick?: () => void; active?: boolean;
  topBorderClass?: string;
}) => {
  const body = (
    <>
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground">{label}</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className={cn("text-2xl font-bold tracking-tight tabular-nums", accent && ACCENT_TEXT[accent])}>{value}</span>
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
          "size-10 rounded-lg grid place-items-center shrink-0",
          cn("bg-secondary text-muted-foreground", onClick && "transition-colors group-hover:bg-primary/10 group-hover:text-primary"),
          active && onClick && "bg-primary/10 text-primary"
        )}>{icon}</div>
      )}
    </>
  );

  const cardBg = topBorderClass ? `border-border ${topBorderClass}` : "border-border";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group rounded-xl border bg-card p-4 flex items-start justify-between gap-4 transition-all hover:shadow-md hover:-translate-y-0.5 text-left w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-sm",
          cardBg,
          active && "ring-2 ring-primary/60 shadow-md -translate-y-0.5"
        )}>
        {body}
      </button>
    );
  }
  return (
    <div className={cn("rounded-xl border bg-card p-4 flex items-start justify-between gap-4 shadow-sm", cardBg)}>
      {body}
    </div>
  );
};

const dotColor = (k: string) =>
  k === "alert" ? "bg-alert" : k === "warning" ? "bg-warning" : "bg-muted-foreground/40";

const filterLabel: Record<FilterKey, string> = {
  all: "All priority cases",
  high: "High priority cases",
  today: "Cases due today or within hours",
};

const Dashboard = () => {
  const { user } = useAuth();
  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0]
    ?? user?.email?.split("@")[0]
    ?? "My";
  const navigate = useNavigate();
  const goQueue = () => navigate("/work-queue");
  const [priorityExpanded, setPriorityExpanded] = useState(false);
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const [kpiFilter, setKpiFilter] = useState<FilterKey>("all");
  const [actionsFilter, setActionsFilter] = useState<"all" | "today">("all");
  const [collabFilters, setCollabFilters] = useState<Record<CollabType, boolean>>({
    comment: true, ai: true, document: true, action: true,
  });

  const [apiEntities, setApiEntities] = useState<ApiEntity[]>([]);

  useEffect(() => {
    fetch(`${AGENT_API_BASE}/api/entities`)
      .then(async r => { if (r.ok) return r.json() as Promise<ApiEntity[]>; })
      .then(data => { if (data) setApiEntities(data); })
      .catch(() => {});
  }, []);

  const entityByKyc = useMemo(
    () => Object.fromEntries(apiEntities.map(e => [e.kyc_ref, e])),
    [apiEntities]
  );

  const priorityCases = useMemo(() => apiEntities.map(toPriorityCase), [apiEntities]);

  const { collab, aiActionsLive } = useMemo(() => {
    const ref = (kyc: string, fallback: string): CaseRef => ({
      name: entityByKyc[kyc]?.entity_name ?? fallback,
      kyc,
    });
    const BREVAN    = ref("KYC-30214", "Brevan Howard Asset Management LLP");
    const MW        = ref("KYC-30188", "Marshall Wace LLP");
    const LONG_FOCUS = ref("KYC-30215", "Long Focus Capital Management, LLC");
    return {
      collab: [
        { type: "comment" as CollabType, title: "Quinn Doe commented on Brevan Howard case file", time: "Today, 7:08 AM", case: BREVAN, snippet: "PSC02 should land within SLA — sent reminder to client compliance." },
        { type: "ai" as CollabType, title: "AI Agent pulled 3 fresh Companies House filings", time: "Yesterday, 3:12 PM", case: BREVAN, snippet: "Auto-refreshed CS01 + PSC register for OC302636." },
        { type: "action" as CollabType, title: "You confirmed PSC for Marshall Wace LLP", time: "April 22, 2026, 7:18 AM", case: MW },
        { type: "comment" as CollabType, title: "Aanya Sharma flagged a Jersey EDD finding", time: "April 22, 2026, 6:03 AM", case: BREVAN, snippet: "BH Partnership Holdings (Jersey) needs source-of-funds before sign-off." },
        { type: "document" as CollabType, title: "Form CS01 uploaded to KYC-30214", time: "April 21, 2026, 4:40 PM", case: BREVAN },
        { type: "ai" as CollabType, title: "AI Agent auto-cleared 1 sanctions false positive", time: "April 21, 2026, 2:11 PM", case: MW, snippet: "DOB + nationality divergence confirmed, cleared by sanctions agent." },
        { type: "comment" as CollabType, title: "Marcus Lee left a note on Long Focus Capital", time: "April 21, 2026, 11:02 AM", case: LONG_FOCUS, snippet: "LEI mismatch with GLEIF — need re-issue confirmation from client." },
      ],
      aiActionsLive: aiActions.map(a => ({ ...a, entity: ref(a.entity.kyc, a.entity.name) })),
    };
  }, [entityByKyc]);

  const toggleKpi = (k: FilterKey) => setKpiFilter((prev) => (prev === k ? "all" : k));

  const totalCases = priorityCases.length;
  const slaAtRisk = priorityCases.filter(c => c.slaRisk).length;
  const highPriorityCount = priorityCases.filter(c => c.priority === "High").length;
  const dueTodayCount = priorityCases.filter(c => c.dueToday).length;

  const filteredCases = useMemo(() => {
    switch (kpiFilter) {
      case "high":  return priorityCases.filter(c => c.priority === "High");
      case "today": return priorityCases.filter(c => c.dueToday);
      default:      return priorityCases;
    }
  }, [kpiFilter, priorityCases]);

  const filteredAiActions = actionsFilter === "today"
    ? aiActionsLive.filter(a => a.dot === "alert")
    : aiActionsLive;

  const filteredCollab = collab.filter(c => collabFilters[c.type]);

  return (
    <div className="px-6 py-6 grid grid-cols-12 gap-6">
      {/* Main column */}
      <div className="col-span-12 xl:col-span-9 space-y-6">
        {/* Page heading */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[18px] font-bold tracking-tight">{firstName}'s Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Real-time view of cases, SLAs and AI-recommended actions across your cases.</p>
          </div>
          <p className="text-xs text-muted-foreground">Last refreshed: Today, 8:42 AM</p>
        </div>

        {/* Top stat row — static queue summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat
            label="Total Cases in Queue"
            value={String(totalCases)}
            unit="open cases"
            trend={{ dir: "up", text: "+3 since last week" }}
            icon={<FileText className="size-5" />}
            topBorderClass="border-t-[3px] border-t-primary"
          />
          <Stat
            label="SLA at Risk"
            value={String(slaAtRisk)}
            unit="cases"
            trend={{ dir: slaAtRisk === 0 ? "down" : "up", text: slaAtRisk === 0 ? "All SLAs on track" : "Due within 48 hours" }}
            accent={slaAtRisk === 0 ? "success" : slaAtRisk < 3 ? "warning" : "alert"}
            topBorderClass={slaAtRisk === 0 ? "border-t-[3px] border-t-success" : slaAtRisk < 3 ? "border-t-[3px] border-t-warning" : "border-t-[3px] border-t-alert"}
            icon={<AlertTriangle className="size-5" />}
          />
          <div className="rounded-xl border border-border border-t-[3px] border-t-success bg-card p-4 flex items-start justify-between shadow-sm">
            <div>
              <p className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground">Cases Complete</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight tabular-nums">48</span>
                <span className="text-lg text-muted-foreground">%</span>
              </div>
              <p className="mt-2 text-xs text-warning flex items-center gap-1 font-medium">
                <ArrowDownRight className="size-3" /> 3% vs yesterday
              </p>
            </div>
            <div className="relative size-12">
              <svg viewBox="0 0 36 36" className="size-12 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--secondary))" strokeWidth="3.6" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--primary))" strokeWidth="3.6"
                  strokeDasharray="48 100" strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 grid place-items-center text-[10px] font-semibold text-primary">48%</span>
            </div>
          </div>
        </div>

        {/* Second stat row — clickable priority shortcuts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {([
            { label: "High Priority",        value: highPriorityCount,                                    borderClass: "border-t-[3px] border-t-alert",      textClass: "text-alert",    action: () => toggleKpi("high"),                                               active: kpiFilter === "high" },
            { label: "Due Today",            value: dueTodayCount,                                        borderClass: "border-t-[3px] border-t-warning",    textClass: "text-warning",  action: () => toggleKpi("today"),                                              active: kpiFilter === "today" },
            { label: "Compliance Alerts",    value: 2,                                                    borderClass: "border-t-[3px] border-t-alert",      textClass: "text-alert",    action: goQueue,                                                               active: false },
            { label: "AI Actions for Today", value: aiActionsLive.filter(a => a.dot === "alert").length, borderClass: "border-t-[3px] border-t-indigo-500", textClass: "text-indigo-500 dark:text-indigo-400", action: () => setActionsFilter((p) => p === "today" ? "all" : "today"), active: actionsFilter === "today" },
          ] as const).map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={s.action}
              className={cn(
                "rounded-xl border border-border bg-card p-4 text-left flex flex-col gap-1 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-primary/40",
                s.borderClass,
                s.active && "ring-2 ring-primary/40 -translate-y-0.5 shadow-md"
              )}
            >
              <p className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground">{s.label}</p>
              <p className={cn("text-2xl font-bold tabular-nums leading-tight", s.textClass)}>{s.value}</p>
            </button>
          ))}
        </div>


        {/* Priority Cases + Recommended Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Priority Cases — 3 by default, expand to scroll */}
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <header className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <h2 className="text-[15px] font-semibold">All Cases</h2>
                <Chip variant="high"><AlertTriangle className="size-3 mr-1" />{highPriorityCount} High</Chip>
              </div>
              <button
                onClick={() => setPriorityExpanded((v) => !v)}
                className="text-xs font-medium text-primary flex items-center gap-1 hover:underline"
              >
                {priorityExpanded ? "Show less" : `Show all (${filteredCases.length})`}
                <ChevronDown className={cn("size-3 transition-transform", priorityExpanded && "rotate-180")} />
              </button>
            </header>

            {kpiFilter !== "all" && (
              <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-info-soft px-2.5 py-1.5">
                <span className="text-[11px] text-primary font-medium truncate">Filtered: {filterLabel[kpiFilter]}</span>
                <button
                  onClick={() => setKpiFilter("all")}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 shrink-0"
                >
                  Clear <X className="size-3" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-[80px_1fr_auto] text-[10px] font-medium uppercase tracking-wide text-muted-foreground pb-2 border-b border-border">
              <span>Priority</span>
              <span>Case / Entity</span>
              <span className="text-right">Due</span>
            </div>

            <ul className={cn(
              "divide-y divide-border",
              priorityExpanded && "max-h-[300px] overflow-y-auto pr-1 -mr-1"
            )}>
              {filteredCases.length === 0 && (
                <li className="py-8 flex flex-col items-center gap-2 text-center">
                  <CheckCircle2 className="size-8 text-success/40" />
                  <p className="text-sm font-medium text-muted-foreground">No cases match this filter</p>
                  <p className="text-xs text-muted-foreground/70">All cases may have been resolved or don't fit the current view.</p>
                </li>
              )}
              {(priorityExpanded ? filteredCases : filteredCases.slice(0, 3)).map((c) => (
                <li key={c.id}>
                  <Link
                    to="/work-queue/review"
                    state={{ entities: [{ name: c.entity, kyc: c.id }] }}
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
                      <p className={cn("text-xs font-medium", c.dueToday ? "text-alert" : "text-foreground")}>{c.due}</p>
                      <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border text-[10px] text-muted-foreground">
                        <Timer className="size-2.5" /> {c.est}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Recommended Actions — 3 by default, expand to scroll */}
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <header className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-[15px] font-semibold flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" /> Recommended Actions
                </h2>
                <Chip variant="high">{aiActionsLive.filter(a => a.dot === "alert").length} Urgent</Chip>
                {actionsFilter === "today" && (
                  <span className="text-[11px] text-primary font-medium px-2 py-0.5 rounded-full border border-primary/30 bg-info-soft">
                    Today only
                  </span>
                )}
              </div>
              <button
                onClick={() => setActionsExpanded((v) => !v)}
                className="text-xs font-medium text-primary flex items-center gap-1 hover:underline"
              >
                {actionsExpanded ? "Show less" : `Show all (${filteredAiActions.length})`}
                <ChevronDown className={cn("size-3 transition-transform", actionsExpanded && "rotate-180")} />
              </button>
            </header>

            <ul className={cn(
              "divide-y divide-border",
              actionsExpanded && "max-h-[400px] overflow-y-auto pr-1 -mr-1"
            )}>
              {(actionsExpanded ? filteredAiActions : filteredAiActions.slice(0, 3)).map((a) => (
                <li key={a.title}>
                  <button
                    type="button"
                    onClick={() => navigate("/work-queue/review", { state: { entities: [a.entity] } })}
                    className="w-full text-left py-3 flex items-start gap-3 hover:bg-secondary/30 -mx-2 px-2 rounded-md transition-colors"
                  >
                    <span className={cn("mt-1.5 size-2 rounded-full shrink-0", dotColor(a.dot))} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium leading-tight">{a.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{a.sub}</p>
                      <p className="text-[11px] text-muted-foreground/90 mt-1 italic line-clamp-1">
                        <span className="not-italic font-medium text-foreground/70">Reason:</span> {a.reason}
                      </p>
                    </div>
                    {a.chip && <Chip variant="high" className="shrink-0">{a.chip}</Chip>}
                    <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-1" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>


      </div>

      {/* Right column: collab */}
      <aside className="col-span-12 xl:col-span-3 space-y-6">
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <header className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-semibold">Collaboration &amp; Insights</h3>
            <button className="text-muted-foreground hover:text-foreground"><Maximize2 className="size-4" /></button>
          </header>

          {/* Filter chips */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(Object.keys(collabMeta) as CollabType[]).map((t) => {
              const meta = collabMeta[t];
              const Icon = meta.icon;
              const active = collabFilters[t];
              return (
                <button
                  key={t}
                  onClick={() => setCollabFilters((p) => ({ ...p, [t]: !p[t] }))}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-medium transition-colors",
                    active
                      ? "border-primary/40 bg-info-soft text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-secondary/40"
                  )}
                >
                  <Icon className="size-3" />
                  {meta.label}
                </button>
              );
            })}
          </div>

          <ul className="space-y-3">
            {filteredCollab.length === 0 && (
              <li className="text-xs text-muted-foreground italic text-center py-3">No events match the selected filters.</li>
            )}
            {filteredCollab.map((c, i) => {
              const meta = collabMeta[c.type];
              const Icon = meta.icon;
              return (
                <li key={i}>
                  <Link
                    to="/work-queue/review"
                    state={{ entities: [c.case] }}
                    className="flex items-start gap-3 -mx-2 px-2 py-1.5 rounded-md hover:bg-secondary/40 transition-colors"
                  >
                    <span className={cn("size-7 rounded-md grid place-items-center shrink-0", meta.tone)}>
                      <Icon className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-tight">{c.title}</p>
                      {c.snippet && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 italic">"{c.snippet}"</p>
                      )}
                      <p className="text-[11px] text-muted-foreground/80 mt-1 flex items-center gap-1.5">
                        <span className="font-medium text-foreground/70">{c.case.kyc}</span>
                        <span>·</span>
                        <span className="truncate">{c.case.name}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">{c.time}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </aside>
    </div>
  );
};

export default Dashboard;
