/**
 * WorkQueue — entity selection table
 *
 * Displays KYC cases grouped by Dedicated Relationship Group (DRG).
 * Entities with no DRG are shown as flat rows below the groups.
 * Analysts select one or more entities and click "Review Selected" to open
 * the ExceptionReview page with the chosen entities pre-loaded.
 *
 * Data source
 * ──────────────────────────────────────────────────────────────
 * Fetches from GET /api/entities (Supabase-backed) at mount.
 * Falls back to an error banner if the server is unreachable.
 */

import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, SlidersHorizontal, ChevronDown, ChevronRight, Lock, Loader2 } from "lucide-react";
import { Chip } from "@/components/Chip";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";
import { AGENT_API_BASE } from "@/components/AgentSystem";
import { useAuth } from "@/contexts/AuthContext";

// ─── API types ────────────────────────────────────────────────────────────────

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

// ─── Row type ─────────────────────────────────────────────────────────────────

type FilterTab = "all" | "periodic-refresh" | "onboarding";

type Row = {
  id: string;
  name: string;
  kyc?: string;
  drg?: string;
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
  rows: Row[];
};

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function mapRisk(r: ApiEntity["risk_rating"]): Row["risk"] {
  if (r === "High") return "Elevated";
  if (r === "Medium") return "Moderate";
  return "Minimal";
}

function mapStatus(s: string): Row["status"] {
  switch (s) {
    case "complete":          return "Complete";
    case "pending_feedback":  return "Pending Feedback";
    case "escalated":         return "In Progress";
    default:                  return "Not Started";
  }
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function toRow(e: ApiEntity): Row {
  const today = new Date();
  const due = e.due_date ? new Date(e.due_date) : null;
  return {
    id: e.kyc_ref,
    name: e.entity_name,
    kyc: e.kyc_ref,
    drg: e.drgs?.name ?? undefined,
    due: formatDate(e.due_date),
    overdue: due ? due < today : false,
    confidence: "High",
    customerType: e.entity_type ?? "—",
    jurisdiction: e.jurisdiction ?? "—",
    priority: e.priority,
    risk: mapRisk(e.risk_rating),
    exc: e.open_exceptions_count,
    status: mapStatus(e.status),
    action: "Periodic Refresh",
  };
}

// ─── Display builder ──────────────────────────────────────────────────────────

function buildDisplay(
  rows: Row[],
  drgByKyc: Record<string, string>,
  activeTab: FilterTab,
): { groups: Group[]; ungrouped: Row[] } {
  const filtered = rows.filter((row) => {
    if (activeTab === "all") return true;
    if (activeTab === "periodic-refresh") return row.action === "Periodic Refresh";
    if (activeTab === "onboarding") return row.action === "Onboarding";
    return true;
  });

  const drgMap = new Map<string, Row[]>();
  const ungrouped: Row[] = [];

  for (const row of filtered) {
    const drg = drgByKyc[row.kyc ?? ""];
    if (drg) {
      if (!drgMap.has(drg)) drgMap.set(drg, []);
      drgMap.get(drg)!.push(row);
    } else {
      ungrouped.push(row);
    }
  }

  // DRGs with only 1 case → flat rows
  for (const [, drgRows] of drgMap.entries()) {
    if (drgRows.length === 1) ungrouped.push(drgRows[0]);
  }
  const multiDrgMap = new Map([...drgMap.entries()].filter(([, r]) => r.length > 1));

  const groups: Group[] = Array.from(multiDrgMap.entries()).map(([drgName, drgRows], i) => {
    const highCount = drgRows.filter((r) => r.priority === "High").length;
    const tone: Group["priorityTone"] = highCount > 0 ? "high" : drgRows.some((r) => r.priority === "Medium") ? "medium" : "low";
    return {
      id: `drg-${i}`,
      name: drgName,
      priorityNote: `${highCount} High Priority Item${highCount !== 1 ? "s" : ""}`,
      priorityTone: tone,
      rows: drgRows,
    };
  });

  return { groups, ungrouped };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const COLS = "grid-cols-[40px_minmax(220px,1.6fr)_180px_110px_minmax(180px,1.4fr)_110px_100px_110px_70px_140px_140px]";

const statusColor = (s: Row["status"]) => {
  switch (s) {
    case "Complete":         return "text-success";
    case "In Progress":      return "text-primary";
    case "Pending Feedback": return "text-[hsl(30_70%_40%)]";
    case "Not Started":      return "text-muted-foreground";
  }
};

const EntityRow = ({
  r,
  selected,
  onToggle,
  indent = false,
}: {
  r: Row;
  selected: boolean;
  onToggle: (id: string, checked: boolean) => void;
  indent?: boolean;
}) => (
  <div
    className={cn(
      `grid ${COLS} gap-2 px-4 py-3 items-center text-sm border-t border-border/60 hover:bg-secondary/30`,
      indent && "pl-8"
    )}
  >
    <span className="flex justify-center">
      {r.locked ? (
        <Lock className="size-4 text-muted-foreground/50" title="Assigned to another analyst — read only" />
      ) : (
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onToggle(r.id, e.target.checked)}
          className="size-4 accent-primary"
        />
      )}
    </span>
    <Link
      to={`/work-queue/review/${r.kyc ?? r.id}`}
      state={{ entities: [{ name: r.name, kyc: r.kyc ?? r.id, drg: r.drg }] }}
      className={cn(
        "text-[13px] hover:underline hover:text-primary transition-colors truncate",
        r.locked ? "text-muted-foreground pointer-events-none" : "text-foreground"
      )}
      onClick={(e) => e.stopPropagation()}
    >{r.name}</Link>
    <span>
      <Chip variant={r.overdue ? "high" : "medium"} className="font-medium">{r.due}</Chip>
    </span>
    <span className="text-[13px] text-muted-foreground">{r.confidence}</span>
    <span className="text-[13px] text-muted-foreground truncate">{r.customerType}</span>
    <span className="text-[13px] text-muted-foreground">{r.jurisdiction}</span>
    <span className="text-[13px]">{r.priority}</span>
    <span className={cn(
      "text-[13px] font-medium",
      r.risk === "Elevated" && "text-alert",
      r.risk === "Moderate" && "text-[hsl(30_70%_40%)]",
      r.risk === "Minimal"  && "text-success"
    )}>{r.risk}</span>
    <span className="text-[13px]">{r.exc}</span>
    <span className={cn("text-[13px] font-medium", statusColor(r.status))}>{r.status}</span>
    <span className="text-[13px] text-muted-foreground">{r.action}</span>
  </div>
);

// ─── Page component ───────────────────────────────────────────────────────────

const WorkQueue = () => {
  const { user } = useAuth();
  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0]
    ?? user?.email?.split("@")[0]
    ?? "My";
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [apiEntities, setApiEntities] = useState<ApiEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`${AGENT_API_BASE}/api/entities`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(`Server returned ${r.status}: ${body?.error ?? 'unknown error'}`);
        }
        return r.json() as Promise<ApiEntity[]>;
      })
      .then((data) => { setApiEntities(data); setLoading(false); })
      .catch((err: Error) => { setError(err.message); setLoading(false); });
  }, []);

  const rows = useMemo(() => apiEntities.map(toRow), [apiEntities]);
  const drgByKyc = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of apiEntities) {
      if (e.drgs?.name) m[e.kyc_ref] = e.drgs.name;
    }
    return m;
  }, [apiEntities]);

  const { groups, ungrouped } = useMemo(
    () => buildDisplay(rows, drgByKyc, activeTab),
    [rows, drgByKyc, activeTab],
  );

  // Open first group by default
  const firstGroupId = groups[0]?.id;
  const effectiveOpen = useMemo<Record<string, boolean>>(() => {
    if (firstGroupId && !Object.keys(openGroups).includes(firstGroupId)) {
      return { [firstGroupId]: true, ...openGroups };
    }
    return openGroups;
  }, [groups, openGroups, firstGroupId]);

  const allRows = useMemo(
    () => [...groups.flatMap((g) => g.rows), ...ungrouped],
    [groups, ungrouped],
  );

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const selectedEntities = allRows
    .filter((r) => selected[r.id])
    .map((r) => ({ name: r.name, kyc: r.kyc ?? r.id, drg: drgByKyc[r.id] ?? undefined }));

  const handleToggle = (id: string, checked: boolean) =>
    setSelected((s) => ({ ...s, [id]: checked }));

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all",              label: "All" },
    { id: "periodic-refresh", label: "Periodic Refresh" },
    { id: "onboarding",       label: "Onboarding" },
  ];

  return (
    <div className="px-6 py-6">
      <div className="mb-5">
        <h1 className="text-[18px] font-bold tracking-tight">{firstName}'s Work Queue</h1>
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
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {loading ? "…" : apiEntities.length}
            </span>
          </div>

          <button className="h-10 px-4 rounded-full border border-primary text-primary text-sm flex items-center gap-2 hover:bg-info-soft transition-colors">
            <SlidersHorizontal className="size-4" />
            Filter
          </button>

          <div className="flex items-center gap-1 ml-2 p-1 rounded-full bg-secondary/60 border border-border">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "px-4 py-1 rounded-full text-sm transition-colors",
                  activeTab === t.id
                    ? "bg-card shadow-sm font-medium"
                    : "text-muted-foreground hover:bg-card/50"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <Link
          to={`/work-queue/review/${selectedEntities[0]?.kyc ?? ''}`}
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
        {/* Header row */}
        <div className={`grid ${COLS} gap-2 px-4 py-3 bg-muted/60 border-b border-border text-[10px] font-medium uppercase tracking-wide text-muted-foreground`}>
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

        {/* Loading state */}
        {loading && (
          <div className="py-16 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading entities…
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="py-16 text-center text-sm text-alert">
            Failed to load entities: {error}
            <br />
            <span className="text-muted-foreground text-xs">Make sure the server is running (<code>npm run server</code>)</span>
          </div>
        )}

        {/* DRG groups */}
        {!loading && !error && groups.map((g) => {
          const open = !!effectiveOpen[g.id];
          return (
            <div key={g.id} className="border-b border-border last:border-0">
              <button
                onClick={() => setOpenGroups((s) => ({ ...s, [g.id]: !open }))}
                className={cn(
                  "w-full grid grid-cols-[40px_40px_1fr] items-center gap-2 px-4 py-3 text-left hover:bg-secondary/40 transition-colors",
                  g.priorityTone === "high"   && "border-l-2 border-l-alert",
                  g.priorityTone === "medium" && "border-l-2 border-l-warning",
                  g.priorityTone === "low"    && "border-l-2 border-l-muted-foreground/30"
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
                    g.priorityTone === "high"   && "text-alert",
                    g.priorityTone === "medium" && "text-[hsl(30_70%_40%)]",
                    g.priorityTone === "low"    && "text-success"
                  )}>{g.priorityNote}</span>
                </div>
              </button>

              {open && g.rows.map((r) => (
                <EntityRow
                  key={r.id}
                  r={r}
                  selected={!!selected[r.id]}
                  onToggle={handleToggle}
                  indent
                />
              ))}
            </div>
          );
        })}

        {/* Ungrouped entities */}
        {!loading && !error && ungrouped.length > 0 && (
          <>
            {groups.length > 0 && (
              <div className="px-4 py-2 bg-secondary/30 border-t border-border">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  No DRG assigned · {ungrouped.length} {ungrouped.length === 1 ? "entity" : "entities"}
                </span>
              </div>
            )}
            {ungrouped.map((r) => (
              <EntityRow
                key={r.id}
                r={r}
                selected={!!selected[r.id]}
                onToggle={handleToggle}
              />
            ))}
          </>
        )}

        {/* Empty state */}
        {!loading && !error && groups.length === 0 && ungrouped.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No cases match the selected filter.
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkQueue;
