import { useMemo, useState, useRef, useEffect } from "react";
import { AlertTriangle, Clock, ChevronRight, ChevronDown, Sparkles, Maximize2, MessageSquare, FileText, Bot, ArrowUpRight, ArrowDownRight, Timer, CheckCircle2, X, Send } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Chip } from "@/components/Chip";
import { cn } from "@/lib/utils";
import { GENERATED_DASHBOARD_CASES, GENERATED_WORK_ROWS } from "@/data/entities-generated";

type FilterKey = "all" | "high" | "today";

// Build from the same 15 entities the work queue uses.
// Notes come from GENERATED_DASHBOARD_CASES (exception-derived summaries).
const _noteMap = Object.fromEntries(
  GENERATED_DASHBOARD_CASES.map((c) => [c.id, { note: c.note, est: c.est }])
);
const priorityCases = GENERATED_WORK_ROWS.map((r) => ({
  priority: r.priority,
  id: r.kyc,
  entity: r.name,
  note: _noteMap[r.kyc]?.note ?? `${r.exc} open exception${r.exc !== 1 ? "s" : ""} requiring resolution.`,
  due: r.due,
  est: _noteMap[r.kyc]?.est ?? (r.exc > 3 ? "45 min" : "30 min"),
  status: "open" as const,
})) as { priority: "High" | "Medium" | "Low"; id: string; entity: string; note: string; due: string; est: string; status: "open" | "complete" }[];

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
const BREVAN: CaseRef = { name: "Brevan Howard Asset Management LLP", kyc: "KYC-30214" };
const MW: CaseRef = { name: "Marshall Wace LLP", kyc: "KYC-30188" };
const LONG_FOCUS: CaseRef = { name: "Long Focus Capital Management, LLC", kyc: "KYC-30215" };

const collab: { type: CollabType; title: string; time: string; case: CaseRef; snippet?: string }[] = [
  { type: "comment", title: "Quinn Doe commented on Brevan Howard case file", time: "Today, 7:08 AM", case: BREVAN, snippet: "PSC02 should land within SLA — sent reminder to client compliance." },
  { type: "ai", title: "AI Agent pulled 3 fresh Companies House filings", time: "Yesterday, 3:12 PM", case: BREVAN, snippet: "Auto-refreshed CS01 + PSC register for OC302636." },
  { type: "action", title: "You confirmed PSC for Marshall Wace LLP", time: "April 22, 2026, 7:18 AM", case: MW },
  { type: "comment", title: "Aanya Sharma flagged a Jersey EDD finding", time: "April 22, 2026, 6:03 AM", case: BREVAN, snippet: "BH Partnership Holdings (Jersey) needs source-of-funds before sign-off." },
  { type: "document", title: "Form CS01 uploaded to KYC-30214", time: "April 21, 2026, 4:40 PM", case: BREVAN },
  { type: "ai", title: "AI Agent auto-cleared 1 sanctions false positive", time: "April 21, 2026, 2:11 PM", case: MW, snippet: "DOB + nationality divergence confirmed, cleared by sanctions agent." },
  { type: "comment", title: "Marcus Lee left a note on Long Focus Capital", time: "April 21, 2026, 11:02 AM", case: LONG_FOCUS, snippet: "LEI mismatch with GLEIF — need re-issue confirmation from client." },
];

const collabMeta: Record<CollabType, { label: string; icon: typeof MessageSquare; tone: string }> = {
  comment: { label: "Comments", icon: MessageSquare, tone: "bg-info-soft text-primary" },
  ai: { label: "AI actions", icon: Bot, tone: "bg-success-soft text-success" },
  document: { label: "Documents", icon: FileText, tone: "bg-warning-soft text-warning" },
  action: { label: "User actions", icon: CheckCircle2, tone: "bg-secondary text-foreground" },
};

const Stat = ({ label, value, unit, trend, accent, icon, soft = false, onClick, active }: {
  label: string; value: string; unit?: string; trend?: { dir: "up" | "down"; text: string };
  accent?: "alert"; icon?: React.ReactNode; soft?: boolean; onClick?: () => void; active?: boolean;
}) => {
  const body = (
    <>
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
          "size-10 rounded-lg grid place-items-center shrink-0",
          soft ? "bg-alert/10 text-alert" : cn("bg-secondary text-muted-foreground", onClick && "transition-colors group-hover:bg-primary/10 group-hover:text-primary"),
          active && onClick && "bg-primary/10 text-primary"
        )}>{icon}</div>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group rounded-xl border bg-card p-5 flex items-start justify-between gap-4 transition-all hover:shadow-md hover:-translate-y-0.5 text-left w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40",
          soft ? "border-alert-soft-border bg-gradient-to-br from-alert-soft to-card" : "border-border",
          active && "ring-2 ring-primary/60 shadow-md -translate-y-0.5"
        )}>
        {body}
      </button>
    );
  }
  return (
    <div className={cn(
      "rounded-xl border bg-card p-5 flex items-start justify-between gap-4",
      soft ? "border-alert-soft-border bg-gradient-to-br from-alert-soft to-card" : "border-border"
    )}>
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

type ChatMessage = { role: "user" | "assistant"; text: string; time: string };

const SUGGESTIONS = [
  "Which cases need my attention?",
  "What's overdue?",
  "Top recommended actions",
  "Summarise my queue",
];

const getMockResponse = (q: string): string => {
  const lq = q.toLowerCase();

  if (lq.match(/attention|urgent|important|critical|high.?prior|escalat/)) {
    return `**2 High Priority cases need your immediate attention:**\n\n**KYC-30214 — Brevan Howard Asset Management LLP**\nPSC nature-of-control change undisclosed. Companies House filing overdue. Due in **2 hours**.\n\n**KYC-30188 — Marshall Wace LLP**\nFCA permission scope change pending evidence. SLA closes **today**.\n\nI recommend starting with KYC-30214 — all exceptions are resolved and it's ready for sign-off.`;
  }
  if (lq.match(/overdue|late|past.?due|missed|breach/)) {
    return `**3 cases are currently overdue:**\n\n- **KYC-30214** · Brevan Howard — 2 hrs overdue\n- **KYC-30188** · Marshall Wace — SLA closes today\n- **KYC-30201** · Brevan Howard — Jersey EDD pending\n\nAll 3 sit in the **London Alternatives DRG**. Marshall Wace is at highest risk of SLA breach.`;
  }
  if (lq.match(/recommend|action|next.?step|what should|to.?do|do next/)) {
    return `**Top 3 recommended actions right now:**\n\n1. 🔴 **Sign off KYC-30214** — Brevan Howard exceptions resolved. Ready for sign-off.\n2. 🔴 **Escalate KYC-30188 FCA scope** — SLA breaches in <4 hrs, no client response.\n3. 🟡 **Run EDD on BH Partnership Holdings** — Jersey domicile triggers policy POL-EDD-23.\n\nThere are 4 further lower-urgency actions in the queue.`;
  }
  if (lq.match(/brevan|oc302636|kyc.?30214/)) {
    return `**Brevan Howard Asset Management LLP (KYC-30214)**\n\n- **Status:** In Progress · High Priority · Elevated Risk\n- **Due:** Overdue — 2 hrs\n- **Open Exceptions:** 3 (PSC address drift, Jersey EDD, name continuity)\n- **Confidence:** 92%\n\n**Recommended:** Sign off — all exceptions addressed. PSC02 correction sent to client with 7-day SLA.`;
  }
  if (lq.match(/marshall.?wace|kyc.?30188|mwam/)) {
    return `**Marshall Wace LLP (KYC-30188)**\n\n- **Status:** Pending Feedback · High Priority · Elevated Risk\n- **Due:** Overdue — SLA closes today\n- **Open Exceptions:** 2 (FCA permission drift, sanctions false positive)\n- **Confidence:** 88%\n\n**Watch out:** FCA shows a new "Managing an AIF" permission added 02/11/2026 — CRM not synced. Triggers AIFMD Article 23 disclosure obligations.`;
  }
  if (lq.match(/long.?focus|kyc.?30215/)) {
    return `**Long Focus Capital Management, LLC (KYC-30215)**\n\n- **Status:** In Progress · High Priority · Elevated Risk\n- **Due:** Jul 02, 2026\n- **Open Exceptions:** 5 (US Reg # mismatch, LEI outstanding, address mismatch, CCO attestation, beneficial owner)\n- **Confidence:** 93%\n\nHighest exception count in the queue. Beneficial owner is unresolved — chain terminates at a Delaware holding company.`;
  }
  if (lq.match(/summar|overview|status|how many|count|total|queue/)) {
    return `**Queue Summary — Today:**\n\n- **High priority:** 2 cases (both overdue)\n- **Medium priority:** 2 cases\n- **Low priority:** 4 cases\n- **Overdue:** 3 cases\n- **48-hr SLA at risk:** 5 cases\n- **Compliance alerts:** 2 unresolved\n- **AI recommended actions:** 7 pending\n\nCritical DRG: **London Alternatives** — 2 high-priority cases, both overdue.`;
  }
  if (lq.match(/sla|deadline|due.?date|time|when/)) {
    return `**SLA Status:**\n\n- 🔴 KYC-30214 — due in **2 hrs**\n- 🔴 KYC-30188 — closes **today**\n- 🟡 KYC-30201 — due **tomorrow**\n- 🟡 KYC-30207 — due **Friday**\n- 🟢 KYC-30222 — due **next week**\n\nAvg response time is **3.2 days** — up 0.4d vs yesterday.`;
  }
  if (lq.match(/edd|jersey|enhanced.?due|bh.?partner/)) {
    return `**Enhanced Due Diligence — BH Partnership Holdings Ltd**\n\nJersey reg. 106333 is a corporate designated member of Brevan Howard LLP. Jersey is listed under **EDD policy POL-EDD-23** due to bank-secrecy heritage.\n\nRequired: source-of-funds, source-of-wealth, natural-person UBO traversal. No EDD pack on file.\n\n**Recommended:** Run the EDD Agent bundle — ~20 min estimated completion.`;
  }
  if (lq.match(/sanction|screening|pep|watchlist/)) {
    return `**Sanctions & Screening Status:**\n\n- ✅ 1 fuzzy match cleared — Sir Paul Marshall vs HMT "Paul Marshall" (DOB & nationality diverge)\n- ✅ 0 active hits across OFAC, EU CFSP, UN 1267, HMT\n- Last run: **Today, 6:00 AM**\n\n**Pending:** Add the cleared identity pair to the screening allowlist to suppress future alerts.`;
  }
  return `I can help you with your KYC case queue. Try asking:\n\n- "Which cases need attention?"\n- "What's overdue?"\n- "Summarise my queue"\n- "Tell me about Brevan Howard"\n- "What are the recommended actions?"\n- "What's the SLA status?"`;
};

// Simple markdown-to-JSX for bold and line breaks
const renderMd = (text: string) =>
  text.split("\n").map((line, li) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <p key={li} className={cn("leading-snug text-[12px]", li > 0 && line === "" ? "mt-1" : li > 0 ? "mt-0.5" : "")}>
        {parts.map((p, pi) =>
          pi % 2 === 1 ? <strong key={pi} className="font-semibold">{p}</strong> : p
        )}
      </p>
    );
  });

const Dashboard = () => {
  const navigate = useNavigate();
  const goQueue = () => navigate("/work-queue");
  const [priorityExpanded, setPriorityExpanded] = useState(false);
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const [kpiFilter, setKpiFilter] = useState<FilterKey>("all");
  const [actionsFilter, setActionsFilter] = useState<"all" | "today">("all");
  const [collabFilters, setCollabFilters] = useState<Record<CollabType, boolean>>({
    comment: true, ai: true, document: true, action: true,
  });

  const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: "assistant",
    text: "You currently have **5 cases** within a 48-hour SLA across the **London Alternatives DRG**, and **2 unresolved compliance alerts** requiring action. How can I help?",
    time: "8:42 AM",
  }]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = (text: string) => {
    const q = text.trim();
    if (!q) return;
    const userMsg: ChatMessage = { role: "user", text: q, time: now() };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);
    setTimeout(() => {
      const reply: ChatMessage = { role: "assistant", text: getMockResponse(q), time: now() };
      setMessages((prev) => [...prev, reply]);
      setIsTyping(false);
    }, 800);
  };

  const toggleKpi = (k: FilterKey) => setKpiFilter((prev) => (prev === k ? "all" : k));

  // Row 1 summary counts (static)
  const totalCases = priorityCases.length;
  const slaAtRisk = priorityCases.filter((c) => c.due.includes("hr") || c.due === "Today" || c.due === "Tomorrow").length;
  // Row 2 filter counts
  const highPriorityCount = priorityCases.filter((c) => c.priority === "High").length;
  const dueTodayCount = priorityCases.filter((c) => c.due.includes("hr") || c.due === "Today").length;

  const filteredCases = useMemo(() => {
    switch (kpiFilter) {
      case "high":  return priorityCases.filter((c) => c.priority === "High");
      case "today": return priorityCases.filter((c) => c.due.includes("hr") || c.due === "Today");
      default:      return priorityCases;
    }
  }, [kpiFilter]);

  const filteredAiActions = actionsFilter === "today"
    ? aiActions.filter((a) => a.dot === "alert")
    : aiActions;

  const filteredCollab = collab.filter((c) => collabFilters[c.type]);

  return (
    <div className="px-6 py-6 grid grid-cols-12 gap-6">
      {/* Main column */}
      <div className="col-span-12 xl:col-span-9 space-y-6">
        {/* Page heading */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">KYC Dashboard</h1>
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
          />
          <Stat
            label="SLA at Risk"
            value={String(slaAtRisk)}
            unit="cases"
            trend={{ dir: "up", text: "Due within 48 hours" }}
            accent="alert"
            soft
            icon={<AlertTriangle className="size-5" />}
          />
          <div className="rounded-xl border border-border bg-card p-5 flex items-start justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground">Cases Complete</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight tabular-nums">48</span>
                <span className="text-xl text-muted-foreground">%</span>
              </div>
              <p className="mt-2 text-xs text-[hsl(30_70%_40%)] flex items-center gap-1 font-medium">
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
          </div>
        </div>

        {/* Second stat row — clickable priority shortcuts */}
        <div className="rounded-xl border border-border bg-card divide-y md:divide-y-0 md:divide-x divide-border grid grid-cols-2 md:grid-cols-4 overflow-hidden">
          {([
            { label: "High Priority", value: highPriorityCount, icon: <AlertTriangle className="size-4" />, accent: true,  action: () => toggleKpi("high"),  active: kpiFilter === "high" },
            { label: "Due Today",     value: dueTodayCount,     icon: <Clock className="size-4" />,          accent: false, action: () => toggleKpi("today"), active: kpiFilter === "today" },
            { label: "Compliance Alerts", value: 2,             icon: <AlertTriangle className="size-4" />, accent: true,  action: goQueue,                   active: false },
            { label: "AI Actions for Today", value: aiActions.filter((a) => a.dot === "alert").length, icon: <Sparkles className="size-4" />, accent: false, action: () => setActionsFilter((p) => p === "today" ? "all" : "today"), active: actionsFilter === "today" },
          ] as const).map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={s.action}
              className={cn(
                "text-left px-4 py-3 hover:bg-secondary/40 transition-colors focus:outline-none focus:bg-secondary/60 flex items-center gap-3",
                s.active && "bg-info-soft"
              )}
            >
              <span className={cn(
                "size-8 rounded-lg grid place-items-center shrink-0",
                s.accent ? "bg-alert/10 text-alert" : "bg-secondary text-muted-foreground"
              )}>{s.icon}</span>
              <div className="min-w-0">
                <p className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground">{s.label}</p>
                <p className={cn("text-lg font-semibold tabular-nums leading-tight", s.accent && "text-alert")}>{s.value}</p>
              </div>
            </button>
          ))}
        </div>


        {/* Priority Cases + Recommended Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Priority Cases — 3 by default, expand to scroll */}
          <section className="rounded-xl border border-border bg-card p-5">
            <header className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <h2 className="text-[15px] font-semibold">All Cases</h2>
                <Chip variant="high"><AlertTriangle className="size-3 mr-1" />2 High</Chip>
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

          {/* Recommended Actions — 3 by default, expand to scroll */}
          <section className="rounded-xl border border-border bg-card p-5">
            <header className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-[15px] font-semibold flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" /> Recommended Actions
                </h2>
                <Chip variant="high">{aiActions.filter((a) => a.dot === "alert").length} Urgent</Chip>
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

      {/* Right column: AI + collab */}
      <aside className="col-span-12 xl:col-span-3 space-y-6">
        <section className="rounded-xl border border-border bg-card flex flex-col" style={{ maxHeight: 480 }}>
          <header className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-border shrink-0">
            <span className="size-7 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
              <Sparkles className="size-3.5" />
            </span>
            <div>
              <p className="text-[13px] font-semibold leading-tight">AI Assistant</p>
              <p className="text-[10px] text-muted-foreground">KYC Agent Orchestrator</p>
            </div>
            <span className="ml-auto flex items-center gap-1 text-[10px] text-success font-medium">
              <span className="size-1.5 rounded-full bg-success animate-pulse" /> Live
            </span>
          </header>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "assistant" && (
                  <span className="size-6 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0 mt-0.5">
                    <Bot className="size-3" />
                  </span>
                )}
                <div className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-[12px]",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-secondary text-foreground rounded-bl-none"
                )}>
                  <div className="space-y-0.5">{renderMd(m.text)}</div>
                  <p className={cn("text-[10px] mt-1", m.role === "user" ? "text-primary-foreground/70 text-right" : "text-muted-foreground")}>{m.time}</p>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-2 justify-start">
                <span className="size-6 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0 mt-0.5">
                  <Bot className="size-3" />
                </span>
                <div className="bg-secondary rounded-xl rounded-bl-none px-3 py-2.5 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                  <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                  <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestion chips — always visible */}
          <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="text-[10px] px-2.5 py-1 rounded-full border border-primary/30 bg-info-soft text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="px-4 pb-4 pt-2 shrink-0 border-t border-border">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
              <input
                className="flex-1 bg-transparent text-[13px] placeholder:text-muted-foreground outline-none"
                placeholder="Ask the AI about your queue…"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(inputValue); } }}
              />
              <button
                onClick={() => handleSend(inputValue)}
                disabled={!inputValue.trim() || isTyping}
                className={cn(
                  "size-7 rounded-md grid place-items-center transition-colors",
                  inputValue.trim() && !isTyping
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                <Send className="size-3.5" />
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
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
