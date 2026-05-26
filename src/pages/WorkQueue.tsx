import { useState } from "react";
import { Link } from "react-router-dom";
import { GENERATED_WORK_ROWS, GENERATED_ENTITY_DRG } from "@/data/entities-generated";
import { Search, SlidersHorizontal, ChevronDown, ChevronRight, Lock } from "lucide-react";
import { Chip } from "@/components/Chip";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  name: string;
  kyc?: string;
  due: string;
  overdue?: boolean;
  confidence: string;
  customerType: string;
  jurisdiction: string;
  priority: "Low" | "Medium" | "High";
  risk: "Minimal" | "Moderate" | "Elevated";
  exc: number;
  status: "Complete" | "In Progress" | "Pending Feedback" | "Not Started";
  action: string;
  locked?: boolean;
  selectable?: boolean;
};

type Group = {
  id: string;
  name: string;
  priorityNote: string;
  priorityTone: "high" | "medium" | "low";
  open?: boolean;
  rows?: Row[];
};

const groups: Group[] = [
  {
    id: "g3",
    name: "US Private Equity DRG",
    priorityNote: "2 Medium Priority Items",
    priorityTone: "medium",
    rows: [
      { id: "r10", name: "Long Focus Capital Management, LLC", kyc: "KYC-30215", due: "Jul 02, 2026", confidence: "93%", customerType: "Registered Investment Adviser", jurisdiction: "US — DE / UK", priority: "High", risk: "Elevated", exc: 5, status: "In Progress", action: "Periodic Refresh", selectable: true },
      { id: "r18", name: "Brookfield Asset Management PIC US, LLC", kyc: "KYC-30216", due: "Jun 30, 2026", confidence: "91%", customerType: "Registered Investment Adviser", jurisdiction: "US — DE", priority: "Medium", risk: "Moderate", exc: 3, status: "In Progress", action: "Periodic Refresh", selectable: true },
      { id: "r11", name: "Apollo Capital Management LP", due: "Jul 02, 2026", confidence: "94%", customerType: "Registered Investment Adviser", jurisdiction: "US — DE", priority: "Medium", risk: "Moderate", exc: 2, status: "In Progress", action: "Periodic Refresh", selectable: true },
      { id: "r12", name: "Silver Lake Management Co. LLC", due: "Jul 15, 2026", confidence: "91%", customerType: "Registered Investment Adviser", jurisdiction: "US — CA", priority: "Medium", risk: "Moderate", exc: 1, status: "Not Started", action: "Periodic Refresh", selectable: true },
      { id: "r17", name: "Vista Equity Partners Management LLC", due: "Jul 21, 2026", confidence: "96%", customerType: "Registered Investment Adviser", jurisdiction: "US — TX", priority: "Low", risk: "Minimal", exc: 0, status: "Pending Feedback", action: "Periodic Refresh", locked: true },
    ],
  },
  {
    id: "g1",
    name: "London Alternatives DRG",
    priorityNote: "2 High Priority Items",
    priorityTone: "high",
    open: true,
    rows: [
      { id: "r1", name: "Brevan Howard Asset Management LLP", kyc: "KYC-30214", due: "Overdue · Apr 25, 2026", overdue: true, confidence: "92%", customerType: "Registered Investment Adviser", jurisdiction: "UK", priority: "High", risk: "Elevated", exc: 3, status: "In Progress", action: "Periodic Refresh", selectable: true },
      { id: "r2", name: "Marshall Wace LLP", kyc: "KYC-30188", due: "Overdue · May 14, 2026", overdue: true, confidence: "88%", customerType: "Registered Investment Adviser", jurisdiction: "UK", priority: "High", risk: "Elevated", exc: 2, status: "Pending Feedback", action: "Periodic Refresh", selectable: true },
      { id: "r3", name: "BH Partnership Holdings Limited", kyc: "KYC-30301", due: "Jun 28, 2026", confidence: "84%", customerType: "Corporate Designated Member", jurisdiction: "Jersey", priority: "Medium", risk: "Elevated", exc: 1, status: "Not Started", action: "Periodic Refresh", selectable: true },
      { id: "r4", name: "Brevan Howard Asset Mgmt Services Ltd", due: "Jun 29, 2026", confidence: "95%", customerType: "Corporate Designated Member", jurisdiction: "UK", priority: "Medium", risk: "Moderate", exc: 0, status: "In Progress", action: "Periodic Refresh", locked: true },
      { id: "r5", name: "Marshall Wace Investment Strategies LLP", due: "Jul 04, 2026", confidence: "91%", customerType: "Sub-Adviser LLP", jurisdiction: "UK", priority: "Low", risk: "Moderate", exc: 0, status: "Pending Feedback", action: "Periodic Refresh", locked: true },
    ],
  },
  {
    id: "g2",
    name: "EMEA Hedge Funds DRG",
    priorityNote: "3 High Priority Items",
    priorityTone: "high",
    rows: [
      { id: "r6", name: "Man Group plc", due: "Overdue · May 02, 2026", overdue: true, confidence: "90%", customerType: "Registered Investment Adviser", jurisdiction: "UK", priority: "High", risk: "Elevated", exc: 4, status: "In Progress", action: "Periodic Refresh", selectable: true },
      { id: "r7", name: "AHL Partners LLP", due: "Overdue · May 18, 2026", overdue: true, confidence: "87%", customerType: "Sub-Adviser LLP", jurisdiction: "UK", priority: "High", risk: "Elevated", exc: 2, status: "Not Started", action: "Periodic Refresh", selectable: true },
      { id: "r8", name: "GLG Partners LP", due: "Overdue · May 22, 2026", overdue: true, confidence: "89%", customerType: "Registered Investment Adviser", jurisdiction: "UK", priority: "High", risk: "Moderate", exc: 3, status: "Pending Feedback", action: "Periodic Refresh", selectable: true },
      { id: "r9", name: "Winton Group Limited", due: "Jul 11, 2026", confidence: "93%", customerType: "Registered Investment Adviser", jurisdiction: "UK", priority: "Medium", risk: "Moderate", exc: 1, status: "In Progress", action: "Periodic Refresh", locked: true },
    ],
  },
  {
    id: "g4",
    name: "APAC Wealth Managers DRG",
    priorityNote: "4 Low Priority Items",
    priorityTone: "low",
    rows: [
      { id: "r13", name: "Platinum Asset Management Ltd", due: "Aug 04, 2026", confidence: "92%", customerType: "Registered Investment Adviser", jurisdiction: "AU", priority: "Low", risk: "Minimal", exc: 0, status: "Not Started", action: "Periodic Refresh", selectable: true },
      { id: "r14", name: "Value Partners Group Ltd", due: "Aug 09, 2026", confidence: "90%", customerType: "Registered Investment Adviser", jurisdiction: "HK", priority: "Low", risk: "Moderate", exc: 1, status: "In Progress", action: "Periodic Refresh", selectable: true },
      { id: "r15", name: "Nikko Asset Management Co., Ltd.", due: "Aug 18, 2026", confidence: "95%", customerType: "Registered Investment Adviser", jurisdiction: "JP", priority: "Low", risk: "Minimal", exc: 0, status: "Pending Feedback", action: "Periodic Refresh", locked: true },
      { id: "r16", name: "Eastspring Investments (Singapore) Ltd", due: "Aug 24, 2026", confidence: "93%", customerType: "Registered Investment Adviser", jurisdiction: "SG", priority: "Low", risk: "Minimal", exc: 0, status: "Not Started", action: "Onboarding", locked: true },
    ],
  },
];

// Inject generated entities from entities.md (new entities only, no duplicates)
{
  const _existingKycs = new Set(groups.flatMap(g => (g.rows ?? []).map(r => r.kyc).filter(Boolean)));
  for (const row of GENERATED_WORK_ROWS) {
    if (_existingKycs.has(row.kyc)) continue;
    const drg = GENERATED_ENTITY_DRG[row.kyc] ?? "US Private Equity DRG";
    const target = groups.find(g => g.name === drg) ?? groups.find(g => g.name.includes("US")) ?? groups[0];
    target?.rows?.push(row as unknown as Row);
    _existingKycs.add(row.kyc);
  }
}

const statusColor = (s: Row["status"]) => {
  switch (s) {
    case "Complete": return "text-success";
    case "In Progress": return "text-primary";
    case "Pending Feedback": return "text-[hsl(30_70%_40%)]";
    case "Not Started": return "text-muted-foreground";
  }
};

const WorkQueue = () => {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedCount = Object.values(selected).filter(Boolean).length;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ g3: true });

  const allRows = groups.flatMap((g) => g.rows ?? []);
  const selectedEntities = allRows
    .filter((r) => selected[r.id])
    .map((r) => ({ name: r.name, kyc: r.kyc ?? r.id.toUpperCase() }));

  return (
    <div className="px-6 py-6">
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight">Work Queue</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Select entities to begin a review session. Locked rows are read-only.</p>
      </div>

      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          <div className="relative w-[340px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              className="w-full h-10 pl-9 pr-12 text-sm rounded-full border border-border bg-card outline-none focus:ring-2 focus:ring-ring/30"
              placeholder="Search entities…"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">389</span>
          </div>

          <button className="h-10 px-4 rounded-full border border-primary text-primary text-sm flex items-center gap-2 hover:bg-info-soft transition-colors">
            <SlidersHorizontal className="size-4" />
            Filter
          </button>

          <div className="flex items-center gap-1 ml-2 p-1 rounded-full bg-secondary/60 border border-border">
            <button className="px-4 py-1 rounded-full bg-card shadow-sm text-sm font-medium">All</button>
            <button className="px-4 py-1 rounded-full text-sm text-muted-foreground hover:bg-card/50">Periodic Refresh</button>
            <button className="px-4 py-1 rounded-full text-sm text-muted-foreground hover:bg-card/50">Onboarding</button>
          </div>
        </div>

        <Link
          to="/work-queue/review"
          state={{ entities: selectedEntities }}
          onClick={(e) => { if (selectedCount === 0) e.preventDefault(); }}
          className={cn(
            "h-10 px-5 rounded-full text-sm font-medium flex items-center gap-2 shadow-sm transition-all",
            selectedCount > 0
              ? "bg-primary text-primary-foreground hover:opacity-95 cursor-pointer"
              : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed pointer-events-none"
          )}
          aria-disabled={selectedCount === 0}
        >
          Review Selected
          <span className="size-5 rounded-full bg-white/20 grid place-items-center text-[11px]">{selectedCount}</span>
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="grid grid-cols-[40px_minmax(220px,1.6fr)_180px_110px_minmax(180px,1.4fr)_110px_100px_110px_70px_140px_140px] gap-2 px-4 py-3 bg-secondary/60 border-b border-border text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <span />
          <span>Entity Name ⇅</span>
          <span>Due Date ↑</span>
          <span>Confidence ⇅</span>
          <span>Customer Type</span>
          <span>Jurisdiction</span>
          <span>Priority</span>
          <span>Risk ⇅</span>
          <span># Exc ⇅</span>
          <span>Status ⇅</span>
          <span>Action ⇅</span>
        </div>

        {groups.map((g) => {
          const open = !!openGroups[g.id];
          return (
            <div key={g.id} className="border-b border-border last:border-0">
              <button
                onClick={() => setOpenGroups((s) => ({ ...s, [g.id]: !open }))}
                className={cn(
                  "w-full grid grid-cols-[40px_40px_1fr] items-center gap-2 px-4 py-3 text-left hover:bg-secondary/40 transition-colors",
                  !g.rows && "opacity-60"
                )}
              >
                <span className="size-4 rounded border border-border" />
                <span className="text-muted-foreground">
                  {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{g.name}</span>
                  <span className={cn(
                    "text-xs",
                    g.priorityTone === "high" && "text-alert",
                    g.priorityTone === "medium" && "text-[hsl(30_70%_40%)]",
                    g.priorityTone === "low" && "text-success"
                  )}>{g.priorityNote}</span>
                </div>
              </button>

              {open && g.rows?.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[40px_minmax(220px,1.6fr)_180px_110px_minmax(180px,1.4fr)_110px_100px_110px_70px_140px_140px] gap-2 px-4 py-3 items-center text-sm border-t border-border/60 hover:bg-secondary/30"
                >
                  <span className="flex justify-center">
                    {r.locked ? (
                      <Lock className="size-4 text-muted-foreground/50" title="Assigned to another analyst — read only" />
                    ) : (
                      <input
                        type="checkbox"
                        checked={!!selected[r.id]}
                        onChange={(e) => setSelected((s) => ({ ...s, [r.id]: e.target.checked }))}
                        className="size-4 accent-primary"
                      />
                    )}
                  </span>
                  <span className={cn("text-[13px]", r.locked && "text-muted-foreground")}>{r.name}</span>
                  <span>
                    <Chip variant={r.overdue ? "high" : "medium"} className="font-medium">
                      {r.due}
                    </Chip>
                  </span>
                  <span className="text-[13px] text-muted-foreground">{r.confidence}</span>
                  <span className="text-[13px] text-muted-foreground truncate">{r.customerType}</span>
                  <span className="text-[13px] text-muted-foreground">{r.jurisdiction}</span>
                  <span className="text-[13px]">{r.priority}</span>
                  <span className={cn(
                    "text-[13px] font-medium",
                    r.risk === "Elevated" && "text-alert",
                    r.risk === "Moderate" && "text-[hsl(30_70%_40%)]",
                    r.risk === "Minimal" && "text-success"
                  )}>{r.risk}</span>
                  <span className="text-[13px]">{r.exc}</span>
                  <span className={cn("text-[13px] font-medium", statusColor(r.status))}>{r.status}</span>
                  <span className="text-[13px] text-muted-foreground">{r.action}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkQueue;
